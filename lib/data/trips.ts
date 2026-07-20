import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Attachment,
  EventType,
  LineMessage,
  ReviewStatus,
  Trip,
  TripEvent,
  TripStatus,
} from "@/lib/types";

const TRIP_SELECT = `
  id, shipment_code, normalized_shipment_code, assignment_date, status,
  origin_name, destination_name, destination_province, destination_map_url,
  planned_delivery_at, actual_arrival_at, completed_at, carrier_code,
  latest_status_text, summary_th, summary_en, confirmation_status,
  manually_overridden_status, updated_at,
  line_groups ( group_name ),
  trip_vehicles ( role, vehicles ( registration_display, brand ) ),
  trip_drivers ( drivers ( name_th, name_en, phone_display ) ),
  trip_containers ( container_number, container_role ),
  review_items ( status )
`;

interface TripRow {
  id: string;
  shipment_code: string | null;
  normalized_shipment_code: string | null;
  assignment_date: string | null;
  status: string;
  origin_name: string | null;
  destination_name: string | null;
  destination_province: string | null;
  destination_map_url: string | null;
  planned_delivery_at: string | null;
  actual_arrival_at: string | null;
  completed_at: string | null;
  carrier_code: string | null;
  latest_status_text: string | null;
  summary_th: string | null;
  summary_en: string | null;
  confirmation_status: string;
  manually_overridden_status: string | null;
  updated_at: string;
  line_groups: { group_name: string | null } | null;
  trip_vehicles: { role: string; vehicles: { registration_display: string; brand: string | null } | null }[];
  trip_drivers: { drivers: { name_th: string | null; name_en: string | null; phone_display: string | null } | null }[];
  trip_containers: { container_number: string; container_role: string | null }[];
  review_items: { status: string }[];
}

function reviewState(rows: { status: string }[]): ReviewStatus {
  if (rows.some((r) => r.status === "open")) return "review_required";
  if (rows.some((r) => r.status === "in_review")) return "in_review";
  return "clear";
}

function mapTrip(
  r: TripRow,
  events: TripEvent[],
  attachments: Attachment[],
  linkedMessageIds: string[],
): Trip {
  const tractor = r.trip_vehicles.find((v) => v.role === "tractor")?.vehicles ?? null;
  const trailer = r.trip_vehicles.find((v) => v.role === "trailer")?.vehicles ?? null;
  const driver = r.trip_drivers[0]?.drivers ?? null;

  return {
    id: r.id,
    shipmentCode: r.shipment_code ?? r.normalized_shipment_code ?? "—",
    assignmentDate: r.assignment_date ?? "",
    status: r.status as TripStatus,
    manualOverride: r.manually_overridden_status != null,
    origin: r.origin_name ?? "—",
    destination: r.destination_name ?? "—",
    destinationProvince: r.destination_province,
    destinationMapUrl: r.destination_map_url,
    tractor: tractor?.registration_display ?? null,
    trailer: trailer?.registration_display ?? null,
    truckBrand: tractor?.brand ?? null,
    carrierCode: r.carrier_code,
    driverNameThai: driver?.name_th ?? null,
    driverNameEnglish: driver?.name_en ?? null,
    driverPhone: driver?.phone_display ?? null,
    loadedContainer: r.trip_containers.find((c) => c.container_role === "loaded")?.container_number ?? null,
    emptyContainer: r.trip_containers.find((c) => c.container_role === "empty")?.container_number ?? null,
    plannedDeliveryAt: r.planned_delivery_at,
    actualArrivalAt: r.actual_arrival_at,
    completedAt: r.completed_at,
    latestStatusText: r.latest_status_text ?? "",
    lastUpdateAt: r.updated_at,
    reviewState: reviewState(r.review_items),
    confidence: r.confirmation_status === "confirmed" ? 0.98 : 0.85,
    lineGroup: r.line_groups?.group_name ?? "—",
    summaryTh: r.summary_th ?? "",
    summaryEn: r.summary_en ?? "",
    events,
    attachments,
    linkedMessageIds,
  };
}

export async function listTrips(limit = 200): Promise<Trip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select(TRIP_SELECT)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as TripRow[]).map((r) => mapTrip(r, [], [], []));
}

export async function getTripById(id: string): Promise<Trip | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("trips").select(TRIP_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as unknown as TripRow;

  const { data: evData } = await supabase
    .from("trip_events")
    .select("id, event_type, event_at, raw_label, description, source_type, source_message_id, confidence, confirmation_status")
    .eq("trip_id", id)
    .eq("is_void", false)
    .order("event_at", { ascending: true });
  const ev = (evData ?? []) as unknown as {
    id: string;
    event_type: string;
    event_at: string | null;
    raw_label: string | null;
    description: string | null;
    source_type: string;
    source_message_id: string | null;
    confidence: number | null;
    confirmation_status: string;
  }[];

  const events: TripEvent[] = ev.map((e) => ({
    id: e.id,
    eventType: e.event_type as EventType,
    eventAt: e.event_at,
    rawLabel: e.raw_label ?? "",
    description: e.description,
    sourceType: e.source_type as TripEvent["sourceType"],
    sourceMessageId: e.source_message_id,
    confidence: e.confidence,
    confirmationStatus: e.confirmation_status as TripEvent["confirmationStatus"],
  }));

  const { data: linkData } = await supabase
    .from("message_trip_links")
    .select("message_id")
    .eq("trip_id", id);
  const linkedMessageIds = ((linkData ?? []) as { message_id: string }[]).map(
    (l) => l.message_id,
  );

  let attachments: Attachment[] = [];
  if (linkedMessageIds.length > 0) {
    const { data: attData } = await supabase
      .from("message_attachments")
      .select("id, original_filename, mime_type, size_bytes")
      .in("line_message_id", linkedMessageIds)
      .eq("retrieval_status", "stored");
    const atts = (attData ?? []) as unknown as {
      id: string;
      original_filename: string | null;
      mime_type: string | null;
      size_bytes: number | null;
    }[];
    attachments = atts.map((a) => ({
      id: a.id,
      kind: (a.mime_type ?? "").startsWith("image/") ? "image" : "file",
      filename: a.original_filename ?? a.id,
      mimeType: a.mime_type ?? "application/octet-stream",
      sizeBytes: a.size_bytes ?? 0,
      caption: null,
    }));
  }

  return mapTrip(row, events, attachments, linkedMessageIds);
}

/** Related LINE messages for a trip (the detail page's message list). */
export async function getTripMessages(tripId: string): Promise<LineMessage[]> {
  const supabase = await createClient();
  const { data: linkData } = await supabase
    .from("message_trip_links")
    .select("message_id")
    .eq("trip_id", tripId);
  const ids = ((linkData ?? []) as { message_id: string }[]).map((l) => l.message_id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("line_messages")
    .select(
      `id, line_message_id, message_type, text_content, sent_at, processing_status, classification,
       line_groups ( group_name ), line_members ( display_name ),
       message_attachments ( original_filename )`,
    )
    .in("id", ids)
    .order("sent_at", { ascending: true });

  type Row = {
    id: string;
    line_message_id: string | null;
    message_type: string;
    text_content: string | null;
    sent_at: string;
    processing_status: string;
    classification: string | null;
    line_groups: { group_name: string | null } | null;
    line_members: { display_name: string | null } | null;
    message_attachments: { original_filename: string | null }[];
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    lineMessageId: r.line_message_id ?? r.id,
    group: r.line_groups?.group_name ?? "—",
    senderName: r.line_members?.display_name ?? "Unknown sender",
    messageType: ["text", "image", "file", "location", "sticker"].includes(r.message_type)
      ? (r.message_type as LineMessage["messageType"])
      : "file",
    text: r.text_content,
    sentAt: r.sent_at,
    processingStatus: r.processing_status as LineMessage["processingStatus"],
    classification: (r.classification as LineMessage["classification"]) ?? null,
    linkedTripId: tripId,
    attachmentName: r.message_attachments?.[0]?.original_filename ?? null,
  }));
}
