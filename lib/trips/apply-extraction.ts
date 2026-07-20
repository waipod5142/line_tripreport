import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, TablesUpdate } from "@/lib/supabase/types";
import type { TripExtraction } from "@/lib/ai/schemas";
import {
  AUTO_APPLY_THRESHOLD,
  REVIEW_THRESHOLD,
  decide,
  isCriticalField,
} from "./confidence";
import { findMatchingTrip, resolveReferencedTrip } from "./matcher";
import {
  normalizePhone,
  normalizeRegistration,
  normalizeShipmentCode,
} from "./normalizers";
import {
  canonicalEventType,
  deriveStatus,
  eventIdempotencyKey,
} from "./status-engine";

type Admin = ReturnType<typeof createAdminClient>;

export interface ApplyInput {
  message: {
    id: string;
    organizationId: string;
    lineGroupId: string | null;
    sentAt: string;
  };
  extraction: TripExtraction;
}

export interface ApplyResult {
  action: "created" | "updated" | "review" | "skipped";
  tripId: string | null;
  reviewItemId: string | null;
  eventsAdded: number;
  notes: string[];
}

const NON_TRIP = new Set(["non_operational", "general_operational_notice"]);

export async function applyExtraction(
  admin: Admin,
  input: ApplyInput,
): Promise<ApplyResult> {
  const { message, extraction } = input;
  const orgId = message.organizationId;
  const overall = extraction.confidence.overall;
  const notes: string[] = [];

  // ── Non-trip messages: keep searchable, never create a trip (§17). ──
  if (NON_TRIP.has(extraction.classification)) {
    await setMessageStatus(admin, message.id, "processed", extraction.classification);
    return { action: "skipped", tripId: null, reviewItemId: null, eventsAdded: 0, notes: ["non-operational"] };
  }
  if (extraction.classification === "unknown") {
    const reviewItemId = await createReview(admin, orgId, message.id, null, "unknown_classification", "low", extraction);
    await setMessageStatus(admin, message.id, "review_required", extraction.classification);
    return { action: "review", tripId: null, reviewItemId, eventsAdded: 0, notes: ["unknown classification"] };
  }

  // ── Match against existing trips (§10.5). ──
  const referencedTripId = await resolveReferencedTrip(admin, orgId, extraction.referencedMessageId);
  const match = await findMatchingTrip(admin, extraction, {
    organizationId: orgId,
    lineGroupId: message.lineGroupId ?? "",
    referencedTripId,
  });
  const code = normalizeShipmentCode(extraction.shipmentCode);

  // ── No match → create a trip, or send to review. ──
  if (!match.tripId) {
    if (!code) {
      const reviewItemId = await createReview(admin, orgId, message.id, null, "missing_shipment_code", "high", extraction);
      await setMessageStatus(admin, message.id, "review_required", extraction.classification);
      return { action: "review", tripId: null, reviewItemId, eventsAdded: 0, notes: ["missing shipment code"] };
    }
    if (overall < REVIEW_THRESHOLD) {
      const reviewItemId = await createReview(admin, orgId, message.id, null, "low_confidence", "medium", extraction);
      await setMessageStatus(admin, message.id, "review_required", extraction.classification);
      return { action: "review", tripId: null, reviewItemId, eventsAdded: 0, notes: ["low confidence"] };
    }

    const tripId = await createTrip(admin, message, extraction, code);
    const eventsAdded = await applyEntitiesAndEvents(admin, tripId, orgId, message, extraction);
    await linkMessage(admin, message.id, tripId, match.method === "none" ? "shipment_new" : match.method, overall);
    await recomputeTrip(admin, tripId, extraction);
    await audit(admin, orgId, "trip.created", tripId, null, { shipment_code: code });

    let reviewItemId: string | null = null;
    if (overall < AUTO_APPLY_THRESHOLD) {
      reviewItemId = await createReview(admin, orgId, message.id, tripId, "low_confidence_new_trip", "low", extraction);
      await setMessageStatus(admin, message.id, "review_required", extraction.classification);
    } else {
      await setMessageStatus(admin, message.id, "processed", extraction.classification);
    }
    return { action: "created", tripId, reviewItemId, eventsAdded, notes };
  }

  // ── Matched but only probable (composite / duplicate) → review, don't write. ──
  const tripId = match.tripId;
  if (match.needsReview) {
    const reason = match.ambiguous ? "duplicate_shipment_candidates" : "probable_match";
    const reviewItemId = await createReview(admin, orgId, message.id, tripId, reason, "high", extraction);
    await linkMessage(admin, message.id, tripId, match.method, overall);
    await setMessageStatus(admin, message.id, "review_required", extraction.classification);
    return { action: "review", tripId, reviewItemId, eventsAdded: 0, notes: [reason] };
  }

  // ── Exact match → update non-destructively. ──
  return updateTrip(admin, tripId, orgId, message, extraction, notes);
}

// ───────────────────────────── update path ─────────────────────────────

const SCALAR_FIELDS: { col: string; key: string; value: (e: TripExtraction) => string | null }[] = [
  { col: "assignment_date", key: "assignmentDate", value: (e) => e.assignmentDate },
  { col: "origin_name", key: "originName", value: (e) => e.originName },
  { col: "destination_name", key: "destinationName", value: (e) => e.destinationName },
  { col: "destination_province", key: "destinationProvince", value: (e) => e.destinationProvince },
  { col: "destination_map_url", key: "destinationMapUrl", value: (e) => e.destinationMapUrl },
  { col: "planned_delivery_at", key: "plannedDeliveryAt", value: (e) => e.plannedDeliveryAt },
  { col: "carrier_code", key: "carrierCode", value: (e) => e.carrierCode },
];

async function updateTrip(
  admin: Admin,
  tripId: string,
  orgId: string,
  message: ApplyInput["message"],
  extraction: TripExtraction,
  notes: string[],
): Promise<ApplyResult> {
  const overall = extraction.confidence.overall;
  const { data: trip } = await admin.from("trips").select("*").eq("id", tripId).single();
  if (!trip) throw new Error(`matched trip ${tripId} not found`);

  const confirmed = trip.confirmation_status === "confirmed";
  const updates: Record<string, string | null> = {};
  const conflicts: string[] = [];

  for (const f of SCALAR_FIELDS) {
    const proposed = f.value(extraction);
    if (proposed == null) continue;
    const current = (trip as Record<string, unknown>)[f.col] as string | null;

    if (current == null || current === "") {
      if (overall >= REVIEW_THRESHOLD) updates[f.col] = proposed; // fill blank
      continue;
    }
    if (current === proposed) continue;

    const conflictWithConfirmed = confirmed && isCriticalField(f.key);
    const d = decide(overall, { exactMatch: true, conflictWithConfirmed });
    if (d === "auto_apply") {
      updates[f.col] = proposed;
      await audit(admin, orgId, "trip.field_changed", tripId, { [f.col]: current }, { [f.col]: proposed });
    } else {
      conflicts.push(f.col);
    }
  }

  if (Object.keys(updates).length > 0) {
    await admin.from("trips").update(updates as TablesUpdate<"trips">).eq("id", tripId);
  }

  const eventsAdded = await applyEntitiesAndEvents(admin, tripId, orgId, message, extraction);
  await linkMessage(admin, message.id, tripId, "shipment_group", overall);
  await recomputeTrip(admin, tripId, extraction);
  await audit(admin, orgId, "trip.updated", tripId, null, { events_added: eventsAdded });

  let reviewItemId: string | null = null;
  if (conflicts.length > 0) {
    reviewItemId = await createReview(admin, orgId, message.id, tripId, "conflicting_field", "high", extraction, { conflicts });
    await setMessageStatus(admin, message.id, "review_required", extraction.classification);
    notes.push(`conflicts: ${conflicts.join(", ")}`);
  } else {
    await setMessageStatus(admin, message.id, "processed", extraction.classification);
  }
  return { action: "updated", tripId, reviewItemId, eventsAdded, notes };
}

// ───────────────────────────── writers ─────────────────────────────

async function createTrip(
  admin: Admin,
  message: ApplyInput["message"],
  e: TripExtraction,
  code: string,
): Promise<string> {
  const events = buildEventList(e, message);
  let status = deriveStatus(events);
  if (status === "draft" && e.classification === "trip_assignment") status = "assigned";

  const { data, error } = await admin
    .from("trips")
    .insert({
      organization_id: message.organizationId,
      primary_line_group_id: message.lineGroupId,
      shipment_code: e.shipmentCode,
      normalized_shipment_code: code,
      assignment_date: e.assignmentDate,
      status,
      origin_name: e.originName,
      destination_name: e.destinationName,
      destination_province: e.destinationProvince,
      destination_map_url: e.destinationMapUrl,
      planned_delivery_at: e.plannedDeliveryAt,
      carrier_code: e.carrierCode,
      latest_status_text: e.latestStatusText,
      summary_th: e.summaryThai,
      summary_en: e.summaryEnglish,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

interface DerivedEvent {
  eventType: ReturnType<typeof canonicalEventType>;
  eventAt: string | null;
  rawLabel: string;
  description: string | null;
}

function buildEventList(e: TripExtraction, message: ApplyInput["message"]): DerivedEvent[] {
  const list: DerivedEvent[] = e.events.map((ev) => ({
    eventType: canonicalEventType(ev.eventType),
    eventAt: ev.eventAt,
    rawLabel: ev.rawLabel,
    description: ev.description,
  }));

  const hasAssignment = list.some((ev) => ev.eventType === "assignment_created");
  if (e.classification === "trip_assignment" && !hasAssignment) {
    list.unshift({
      eventType: "assignment_created",
      eventAt: e.assignmentDate ? `${e.assignmentDate}T00:00:00+07:00` : message.sentAt,
      rawLabel: "assignment",
      description: null,
    });
  }
  return list;
}

async function applyEntitiesAndEvents(
  admin: Admin,
  tripId: string,
  orgId: string,
  message: ApplyInput["message"],
  e: TripExtraction,
): Promise<number> {
  const overall = e.confidence.overall;

  if (e.tractorRegistration) await addVehicle(admin, orgId, tripId, message.id, e.tractorRegistration, e.truckBrand, "tractor");
  if (e.trailerRegistration) await addVehicle(admin, orgId, tripId, message.id, e.trailerRegistration, null, "trailer");
  if (e.driverNameThai || e.driverNameEnglish || e.driverPhone) await addDriver(admin, orgId, tripId, message.id, e);
  if (e.loadedContainerNumber) await addContainer(admin, tripId, message.id, e.loadedContainerNumber, "loaded");
  if (e.emptyContainerNumber) await addContainer(admin, tripId, message.id, e.emptyContainerNumber, "empty");

  let added = 0;
  for (const ev of buildEventList(e, message)) {
    const inserted = await addEvent(admin, {
      orgId,
      tripId,
      sourceMessageId: message.id,
      eventType: ev.eventType,
      eventAt: ev.eventAt,
      rawLabel: ev.rawLabel,
      description: ev.description,
      confidence: overall,
    });
    if (inserted) added += 1;
  }
  return added;
}

async function addEvent(
  admin: Admin,
  p: {
    orgId: string;
    tripId: string;
    sourceMessageId: string;
    eventType: string;
    eventAt: string | null;
    rawLabel: string;
    description: string | null;
    confidence: number;
  },
): Promise<boolean> {
  const key = eventIdempotencyKey({
    tripId: p.tripId,
    eventType: p.eventType,
    eventAt: p.eventAt,
    sourceMessageId: p.sourceMessageId,
  });
  const { data, error } = await admin
    .from("trip_events")
    .upsert(
      {
        organization_id: p.orgId,
        trip_id: p.tripId,
        event_type: p.eventType,
        event_at: p.eventAt,
        description: p.description,
        raw_label: p.rawLabel,
        source_message_id: p.sourceMessageId,
        source_type: "line",
        confidence: p.confidence,
        idempotency_key: key,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function addVehicle(
  admin: Admin,
  orgId: string,
  tripId: string,
  messageId: string,
  displayReg: string,
  brand: string | null,
  role: "tractor" | "trailer",
): Promise<void> {
  const normalized = normalizeRegistration(displayReg);
  if (!normalized) return;

  const { data: vehicle } = await admin
    .from("vehicles")
    .upsert(
      {
        organization_id: orgId,
        registration_display: displayReg,
        registration_normalized: normalized,
        brand,
        vehicle_type: role,
      },
      { onConflict: "organization_id,registration_normalized" },
    )
    .select("id")
    .single();
  if (!vehicle) return;

  const existing = await admin
    .from("trip_vehicles")
    .select("id")
    .eq("trip_id", tripId)
    .eq("vehicle_id", vehicle.id)
    .eq("role", role)
    .maybeSingle();
  if (existing.data) return;

  await admin.from("trip_vehicles").insert({
    trip_id: tripId,
    vehicle_id: vehicle.id,
    role,
    source_message_id: messageId,
  });
}

async function addDriver(
  admin: Admin,
  orgId: string,
  tripId: string,
  messageId: string,
  e: TripExtraction,
): Promise<void> {
  const phoneNorm = normalizePhone(e.driverPhone);

  // Reuse a driver matched by normalized phone, else by Thai name.
  let driverId: string | null = null;
  if (phoneNorm) {
    const { data } = await admin.from("drivers").select("id").eq("organization_id", orgId).eq("phone_normalized", phoneNorm).maybeSingle();
    driverId = data?.id ?? null;
  }
  if (!driverId && e.driverNameThai) {
    const { data } = await admin.from("drivers").select("id").eq("organization_id", orgId).eq("name_th", e.driverNameThai).maybeSingle();
    driverId = data?.id ?? null;
  }
  if (!driverId) {
    const { data } = await admin
      .from("drivers")
      .insert({
        organization_id: orgId,
        name_th: e.driverNameThai,
        name_en: e.driverNameEnglish,
        phone_display: e.driverPhone,
        phone_normalized: phoneNorm,
      })
      .select("id")
      .single();
    driverId = data?.id ?? null;
  }
  if (!driverId) return;

  const existing = await admin.from("trip_drivers").select("id").eq("trip_id", tripId).eq("driver_id", driverId).maybeSingle();
  if (existing.data) return;
  await admin.from("trip_drivers").insert({ trip_id: tripId, driver_id: driverId, source_message_id: messageId });
}

async function addContainer(
  admin: Admin,
  tripId: string,
  messageId: string,
  containerNumber: string,
  role: "loaded" | "empty",
): Promise<void> {
  const existing = await admin
    .from("trip_containers")
    .select("id")
    .eq("trip_id", tripId)
    .eq("container_number", containerNumber)
    .maybeSingle();
  if (existing.data) return;
  await admin.from("trip_containers").insert({
    trip_id: tripId,
    container_number: containerNumber,
    container_role: role,
    source_message_id: messageId,
  });
}

async function linkMessage(
  admin: Admin,
  messageId: string,
  tripId: string,
  method: string,
  confidence: number,
): Promise<void> {
  await admin
    .from("message_trip_links")
    .upsert(
      { message_id: messageId, trip_id: tripId, link_method: method, confidence },
      { onConflict: "message_id,trip_id", ignoreDuplicates: true },
    );
}

async function recomputeTrip(
  admin: Admin,
  tripId: string,
  e: TripExtraction,
): Promise<void> {
  const { data: trip } = await admin.from("trips").select("manually_overridden_status").eq("id", tripId).single();
  const { data: events } = await admin
    .from("trip_events")
    .select("event_type, event_at, is_void")
    .eq("trip_id", tripId);

  const status = deriveStatus(
    (events ?? []).map((ev) => ({
      eventType: ev.event_type as ReturnType<typeof canonicalEventType>,
      eventAt: ev.event_at,
      isVoid: ev.is_void,
    })),
    (trip?.manually_overridden_status as never) ?? null,
  );

  const patch: Record<string, string | null> = { status };
  if (e.latestStatusText) patch.latest_status_text = e.latestStatusText;
  if (e.summaryThai) patch.summary_th = e.summaryThai;
  if (e.summaryEnglish) patch.summary_en = e.summaryEnglish;
  if (status === "completed") patch.completed_at = new Date().toISOString();

  await admin.from("trips").update(patch as TablesUpdate<"trips">).eq("id", tripId);
}

async function createReview(
  admin: Admin,
  orgId: string,
  messageId: string,
  tripId: string | null,
  reasonCode: string,
  priority: "high" | "medium" | "low",
  extraction: TripExtraction,
  extra?: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin
    .from("review_items")
    .insert({
      organization_id: orgId,
      message_id: messageId,
      trip_id: tripId,
      reason_code: reasonCode,
      priority,
      proposed_changes: { extraction, ...extra } as unknown as Json,
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function setMessageStatus(
  admin: Admin,
  messageId: string,
  status: string,
  classification: string,
): Promise<void> {
  await admin
    .from("line_messages")
    .update({ processing_status: status, classification })
    .eq("id", messageId);
}

async function audit(
  admin: Admin,
  orgId: string,
  action: string,
  entityId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Promise<void> {
  await admin.from("audit_logs").insert({
    organization_id: orgId,
    actor_type: "system",
    actor_id: "ai-worker",
    action,
    entity_type: "trip",
    entity_id: entityId,
    before_json: (before ?? null) as Json,
    after_json: (after ?? null) as Json,
  });
}
