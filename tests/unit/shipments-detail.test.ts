import { describe, expect, it } from "vitest";
import { stageSummaries, type StageEvent } from "@/lib/shipments/stages";
import { bangkokLocalToIso, isoToBangkokLocal } from "@/lib/shipments/time";

const ev = (
  stage: StageEvent["stage"],
  status: StageEvent["status"],
  occurredAt: string,
): StageEvent => ({ stage, status, occurredAt });

describe("stageSummaries", () => {
  it("lists all six stages in order, empty by default", () => {
    const s = stageSummaries([]);
    expect(s.map((x) => x.stage)).toEqual([
      "picking",
      "departed",
      "arrived",
      "unloaded",
      "pallet_pickup",
      "pallet_returned",
    ]);
    expect(s.every((x) => x.state === "none" && x.at === null)).toBe(true);
  });

  it("prefers confirmed over suggested and takes the earliest time", () => {
    const s = stageSummaries([
      ev("arrived", "suggested", "2026-09-29T00:00:00Z"),
      ev("arrived", "confirmed", "2026-09-29T02:00:00Z"),
      ev("arrived", "confirmed", "2026-09-29T01:27:00Z"),
      ev("unloaded", "suggested", "2026-09-29T07:17:00Z"),
      ev("picking", "rejected", "2026-09-28T13:37:00Z"),
    ]);
    const by = Object.fromEntries(s.map((x) => [x.stage, x]));
    expect(by.arrived).toEqual({ stage: "arrived", state: "done", at: "2026-09-29T01:27:00Z" });
    expect(by.unloaded).toEqual({ stage: "unloaded", state: "suggested", at: "2026-09-29T07:17:00Z" });
    expect(by.picking.state).toBe("none");
  });
});

describe("bangkok time", () => {
  it("converts Bangkok wall-clock to UTC", () => {
    expect(bangkokLocalToIso("2026-09-30T14:05")).toBe("2026-09-30T07:05:00.000Z");
    expect(bangkokLocalToIso("2026-10-01T03:00")).toBe("2026-09-30T20:00:00.000Z");
  });

  it("rejects malformed or impossible times", () => {
    expect(bangkokLocalToIso("2026-09-31T10:00")).toBeNull();
    expect(bangkokLocalToIso("2026-09-30T24:00")).toBeNull();
    expect(bangkokLocalToIso("2026-09-30 10:00")).toBeNull();
    expect(bangkokLocalToIso("")).toBeNull();
  });

  it("round-trips", () => {
    expect(isoToBangkokLocal("2026-09-30T07:05:00.000Z")).toBe("2026-09-30T14:05");
    expect(bangkokLocalToIso(isoToBangkokLocal("2026-09-30T20:00:00Z"))).toBe(
      "2026-09-30T20:00:00.000Z",
    );
  });
});
