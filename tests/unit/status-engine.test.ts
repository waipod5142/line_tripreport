import { describe, expect, it } from "vitest";
import {
  canonicalEventType,
  deriveStatus,
  eventIdempotencyKey,
} from "@/lib/trips/status-engine";

describe("canonicalEventType", () => {
  it("passes through known types and normalizes spacing", () => {
    expect(canonicalEventType("unloading_completed")).toBe("unloading_completed");
    expect(canonicalEventType("Customs Thai Released")).toBe("customs_thai_released");
  });
  it("falls back to status_note for unknown types", () => {
    expect(canonicalEventType("random driver chatter")).toBe("status_note");
  });
});

describe("deriveStatus", () => {
  it("derives completed from the TPL6.5 timeline", () => {
    const events = [
      { eventType: "assignment_created" as const, eventAt: "2026-07-06T16:20:00+07:00" },
      { eventType: "loaded_container_received" as const, eventAt: "2026-07-07T10:36:00+07:00" },
      { eventType: "customs_lao_released" as const, eventAt: "2026-07-07T11:15:00+07:00" },
      { eventType: "customs_thai_released" as const, eventAt: "2026-07-07T13:18:00+07:00" },
      { eventType: "arrived_destination" as const, eventAt: "2026-07-08T03:24:00+07:00" },
      { eventType: "unloading_started" as const, eventAt: "2026-07-08T05:35:00+07:00" },
      { eventType: "unloading_completed" as const, eventAt: "2026-07-08T06:00:00+07:00" },
    ];
    expect(deriveStatus(events)).toBe("completed");
  });

  it("ignores event ordering in the input array (sorts by time)", () => {
    const events = [
      { eventType: "arrived_destination" as const, eventAt: "2026-07-08T03:24:00+07:00" },
      { eventType: "assignment_created" as const, eventAt: "2026-07-06T16:20:00+07:00" },
    ];
    expect(deriveStatus(events)).toBe("arrived");
  });

  it("lets a manual override win", () => {
    const events = [
      { eventType: "assignment_created" as const, eventAt: "2026-07-06T16:20:00+07:00" },
    ];
    expect(deriveStatus(events, "exception")).toBe("exception");
  });

  it("defaults to draft with no mapped events", () => {
    expect(deriveStatus([{ eventType: "status_note", eventAt: null }])).toBe("draft");
  });
});

describe("eventIdempotencyKey", () => {
  const base = {
    tripId: "trip-1",
    eventType: "customs_thai_released",
    eventAt: "2026-07-07T13:18:00+07:00",
    sourceMessageId: "msg-1",
  };

  it("is stable for the same inputs (to the minute)", () => {
    const a = eventIdempotencyKey(base);
    const b = eventIdempotencyKey({ ...base, eventAt: "2026-07-07T13:18:45+07:00" });
    expect(a).toBe(b); // seconds are normalized away
  });

  it("differs when the event type or trip changes", () => {
    expect(eventIdempotencyKey(base)).not.toBe(
      eventIdempotencyKey({ ...base, eventType: "arrived_destination" }),
    );
    expect(eventIdempotencyKey(base)).not.toBe(
      eventIdempotencyKey({ ...base, tripId: "trip-2" }),
    );
  });
});
