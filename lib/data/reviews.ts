import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ReviewItem } from "@/lib/types";

// Human labels for the reason codes emitted by lib/trips/apply-extraction.ts.
const REASON_LABELS: Record<string, string> = {
  unknown_classification: "Unknown message type",
  missing_shipment_code: "Missing shipment code",
  low_confidence: "Low-confidence extraction",
  low_confidence_new_trip: "Low-confidence new trip",
  duplicate_shipment_candidates: "Duplicate shipment candidates",
  probable_match: "Probable trip match",
};

function labelFor(reasonCode: string): string {
  return (
    REASON_LABELS[reasonCode] ??
    reasonCode.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

// The scalar fields we surface as a diff. `tripCol` (when set) is the matching
// column on `trips`, used to show the current value for an already-linked trip.
const FIELD_DEFS: {
  label: string;
  extract: (e: Extraction) => string | null | undefined;
  tripCol: string | null;
}[] = [
  { label: "Shipment code", extract: (e) => e.shipmentCode, tripCol: "shipment_code" },
  { label: "Assignment date", extract: (e) => e.assignmentDate, tripCol: "assignment_date" },
  { label: "Origin", extract: (e) => e.originName, tripCol: "origin_name" },
  { label: "Destination", extract: (e) => e.destinationName, tripCol: "destination_name" },
  { label: "Province", extract: (e) => e.destinationProvince, tripCol: "destination_province" },
  { label: "Planned delivery", extract: (e) => e.plannedDeliveryAt, tripCol: "planned_delivery_at" },
  { label: "Carrier", extract: (e) => e.carrierCode, tripCol: "carrier_code" },
  { label: "Tractor", extract: (e) => e.tractorRegistration, tripCol: null },
  { label: "Trailer", extract: (e) => e.trailerRegistration, tripCol: null },
  { label: "Driver (TH)", extract: (e) => e.driverNameThai, tripCol: null },
  { label: "Driver phone", extract: (e) => e.driverPhone, tripCol: null },
  { label: "Loaded container", extract: (e) => e.loadedContainerNumber, tripCol: null },
  { label: "Empty container", extract: (e) => e.emptyContainerNumber, tripCol: null },
];

// Subset of the persisted TripExtraction we read out of proposed_changes.
interface Extraction {
  shipmentCode?: string | null;
  assignmentDate?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  destinationProvince?: string | null;
  plannedDeliveryAt?: string | null;
  carrierCode?: string | null;
  tractorRegistration?: string | null;
  trailerRegistration?: string | null;
  driverNameThai?: string | null;
  driverPhone?: string | null;
  loadedContainerNumber?: string | null;
  emptyContainerNumber?: string | null;
  confidence?: { overall?: number } | null;
}

interface ReviewRow {
  id: string;
  reason_code: string;
  priority: "high" | "medium" | "low";
  created_at: string;
  message_id: string | null;
  trip_id: string | null;
  proposed_changes: { extraction?: Extraction } | null;
  line_messages: {
    text_content: string | null;
    line_members: { display_name: string | null } | null;
    line_groups: { group_name: string | null } | null;
  } | null;
  trips: {
    shipment_code: string | null;
    normalized_shipment_code: string | null;
  } | null;
}

/**
 * Open review queue (PRD §16 / §23). Reads review_items scoped by RLS to the
 * caller's organization; derives the proposed-change diff from the extraction
 * snapshot stored on each item, filling "current" from the linked trip.
 */
export async function listReviewItems(limit = 100): Promise<ReviewItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("review_items")
    .select(
      `
      id, reason_code, priority, created_at, message_id, trip_id, proposed_changes,
      line_messages ( text_content, line_members ( display_name ), line_groups ( group_name ) ),
      trips ( shipment_code, normalized_shipment_code )
    `,
    )
    .in("status", ["open", "in_review"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as unknown as ReviewRow[];

  // Fetch current scalar values for any linked trips, in one round-trip.
  const tripIds = Array.from(
    new Set(rows.map((r) => r.trip_id).filter((v): v is string => Boolean(v))),
  );
  const currentByTrip = new Map<string, Record<string, string | null>>();
  if (tripIds.length > 0) {
    const { data: tripData } = await supabase
      .from("trips")
      .select(
        "id, shipment_code, assignment_date, origin_name, destination_name, destination_province, planned_delivery_at, carrier_code",
      )
      .in("id", tripIds);
    for (const t of (tripData ?? []) as unknown as Record<string, string | null>[]) {
      currentByTrip.set(t.id as string, t);
    }
  }

  return rows.map((r) => {
    const extraction = r.proposed_changes?.extraction ?? {};
    const current = r.trip_id ? currentByTrip.get(r.trip_id) : undefined;

    const proposed = FIELD_DEFS.map((f) => {
      const value = f.extract(extraction) ?? null;
      const cur = f.tripCol && current ? current[f.tripCol] ?? null : null;
      return { field: f.label, current: cur, proposed: value };
    }).filter((p) => p.proposed != null || p.current != null);

    return {
      id: r.id,
      reasonCode: r.reason_code,
      reasonLabel: labelFor(r.reason_code),
      priority: r.priority,
      createdAt: r.created_at,
      shipmentCandidate:
        r.trips?.shipment_code ??
        r.trips?.normalized_shipment_code ??
        extraction.shipmentCode ??
        null,
      tripId: r.trip_id,
      messageId: r.message_id ?? "",
      messageText: r.line_messages?.text_content ?? "",
      senderName: r.line_messages?.line_members?.display_name ?? "Unknown sender",
      group: r.line_messages?.line_groups?.group_name ?? "—",
      confidence: extraction.confidence?.overall ?? 0,
      proposed,
    };
  });
}
