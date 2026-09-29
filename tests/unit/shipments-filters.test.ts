import { describe, expect, it } from "vitest";
import {
  matchesStage,
  parseIsoDate,
  parseShipmentFilters,
  shipmentFiltersToQuery,
} from "@/lib/shipments/filters";

describe("parseShipmentFilters", () => {
  it("defaults to the latest plan and every stage", () => {
    expect(parseShipmentFilters({})).toEqual({ date: null, stage: "all" });
  });

  it("accepts a real date and a known stage", () => {
    expect(parseShipmentFilters({ date: "2026-09-30", stage: "arrived" })).toEqual({
      date: "2026-09-30",
      stage: "arrived",
    });
    expect(parseShipmentFilters({ stage: "not_started" }).stage).toBe("not_started");
  });

  it("drops anything outside the vocabulary rather than passing it through", () => {
    expect(parseShipmentFilters({ date: "2026-02-31", stage: "delivered" })).toEqual({
      date: null,
      stage: "all",
    });
    expect(parseShipmentFilters({ date: "30/09/2026" }).date).toBeNull();
    expect(parseShipmentFilters({ date: "2026-09-30' or 1=1" }).date).toBeNull();
  });

  it("takes the first value of a repeated param", () => {
    expect(parseShipmentFilters({ stage: ["unloaded", "picking"] }).stage).toBe("unloaded");
  });
});

describe("parseIsoDate", () => {
  it("rejects impossible dates", () => {
    expect(parseIsoDate("2026-13-01")).toBeNull();
    expect(parseIsoDate("2028-02-29")).toBe("2028-02-29");
    expect(parseIsoDate("2026-02-29")).toBeNull();
  });
});

describe("shipmentFiltersToQuery", () => {
  it("round-trips and omits defaults", () => {
    expect(shipmentFiltersToQuery({ date: null, stage: "all" })).toBe("");
    const f = { date: "2026-09-30", stage: "pallet_pickup" } as const;
    expect(parseShipmentFilters(Object.fromEntries(new URLSearchParams(shipmentFiltersToQuery(f))))).toEqual(f);
  });
});

describe("matchesStage", () => {
  it("separates not-started from in-progress", () => {
    expect(matchesStage(null, "not_started")).toBe(true);
    expect(matchesStage("picking", "not_started")).toBe(false);
    expect(matchesStage("picking", "picking")).toBe(true);
    expect(matchesStage("departed", "picking")).toBe(false);
    expect(matchesStage(null, "all")).toBe(true);
  });
});
