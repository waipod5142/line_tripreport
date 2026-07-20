import crypto from "node:crypto";
import type { EventType, TripStatus } from "@/lib/types";

// Maps each operational event to the trip status it implies. Events not listed
// (e.g. status_note) don't move the status. Current status is derived from the
// latest mapped event plus any manual override (PRD §10.6).
export const EVENT_STATUS_MAP: Partial<Record<EventType, TripStatus>> = {
  assignment_created: "assigned",
  arrived_origin: "at_origin",
  loaded_container_received: "at_origin",
  customs_lao_released: "border_processing",
  customs_thai_released: "released",
  departed_origin: "in_transit",
  arrived_destination: "arrived",
  loading_started: "loading",
  loading_completed: "loading",
  unloading_started: "unloading",
  unloading_completed: "completed",
  trip_completed: "completed",
  trip_cancelled: "cancelled",
};

const CANONICAL_EVENTS = new Set<string>(Object.keys({
  assignment_created: 1, arrived_origin: 1, loaded_container_received: 1,
  customs_lao_released: 1, customs_thai_released: 1, departed_origin: 1,
  arrived_destination: 1, loading_started: 1, loading_completed: 1,
  unloading_started: 1, unloading_completed: 1, trip_completed: 1,
  trip_cancelled: 1, status_note: 1,
}));

/** Coerce a free-form AI event type into the known vocabulary. */
export function canonicalEventType(raw: string): EventType {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (CANONICAL_EVENTS.has(key) ? key : "status_note") as EventType;
}

export interface DerivableEvent {
  eventType: EventType;
  eventAt: string | null;
  isVoid?: boolean;
}

/**
 * Derive the current status from the event timeline. A manual override always
 * wins (PRD §10.6). Events are ordered by time; the latest mapped event decides.
 */
export function deriveStatus(
  events: DerivableEvent[],
  manualOverride?: TripStatus | null,
): TripStatus {
  if (manualOverride) return manualOverride;

  const ordered = events
    .filter((e) => !e.isVoid)
    .sort((a, b) => timeValue(a.eventAt) - timeValue(b.eventAt));

  let status: TripStatus = "draft";
  for (const e of ordered) {
    const mapped = EVENT_STATUS_MAP[e.eventType];
    if (mapped) status = mapped;
  }
  return status;
}

function timeValue(iso: string | null): number {
  if (!iso) return Number.MAX_SAFE_INTEGER; // undated events sort last
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/**
 * Deterministic idempotency key for a timeline event (PRD §14.1). Includes the
 * trip, event type, event time normalized to the minute, and source message, so
 * a replayed webhook/job can never create the same event twice.
 */
export function eventIdempotencyKey(params: {
  tripId: string;
  eventType: string;
  eventAt: string | null;
  sourceMessageId: string | null;
}): string {
  const normTime = params.eventAt
    ? new Date(params.eventAt).toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
    : "no-time";
  const basis = [
    params.tripId,
    params.eventType,
    normTime,
    params.sourceMessageId ?? "no-source",
  ].join("|");
  return crypto.createHash("sha256").update(basis).digest("hex");
}
