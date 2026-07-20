import { describe, expect, it } from "vitest";
import { decide, isCriticalField } from "@/lib/trips/confidence";

describe("decide (confidence policy §16.2)", () => {
  it("auto-applies at >= 0.90 with no conflict", () => {
    expect(decide(0.95, { exactMatch: true, conflictWithConfirmed: false })).toBe(
      "auto_apply",
    );
  });

  it("applies event-only in 0.70–0.89 when the match is exact", () => {
    expect(decide(0.8, { exactMatch: true, conflictWithConfirmed: false })).toBe(
      "apply_event",
    );
  });

  it("reviews in 0.70–0.89 when the match is not exact", () => {
    expect(decide(0.8, { exactMatch: false, conflictWithConfirmed: false })).toBe(
      "review",
    );
  });

  it("reviews below 0.70", () => {
    expect(decide(0.5, { exactMatch: true, conflictWithConfirmed: false })).toBe(
      "review",
    );
  });

  it("always reviews on conflict with a confirmed critical field", () => {
    expect(decide(0.99, { exactMatch: true, conflictWithConfirmed: true })).toBe(
      "review",
    );
  });

  it("knows which fields are critical", () => {
    expect(isCriticalField("shipmentCode")).toBe(true);
    expect(isCriticalField("truckBrand")).toBe(false);
  });
});
