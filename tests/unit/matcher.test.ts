import { describe, it, expect, vi } from "vitest";

// matcher.ts (and the admin client it imports for a type) pull in `server-only`,
// which throws outside an RSC environment. Stub both so we can unit-test the
// pure matching logic; findMatchingTrip receives its admin client as an argument.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { findMatchingTrip } from "@/lib/trips/matcher";
import type { TripExtraction } from "@/lib/ai/schemas";

type Rows = { id: string }[];

/**
 * Minimal thenable stub of the supabase query builder. The exact-code query ends
 * in `.eq("normalized_shipment_code", …)`; the composite query ends in
 * `.ilike("destination_name", …)`. We return `exact` or `composite` rows based
 * on which path a given chain took.
 */
function fakeAdmin({ exact = [], composite = [] }: { exact?: Rows; composite?: Rows }) {
  const from = () => {
    const calls: string[] = [];
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (col: string) => {
        calls.push(`eq:${col}`);
        return b;
      },
      ilike: (col: string) => {
        calls.push(`ilike:${col}`);
        return b;
      },
      then: (resolve: (v: { data: Rows }) => unknown) => {
        const isComposite = calls.some((c) => c.startsWith("ilike:"));
        return Promise.resolve({ data: isComposite ? composite : exact }).then(resolve);
      },
    };
    return b;
  };
  return { from } as unknown as Parameters<typeof findMatchingTrip>[0];
}

const ctx = { organizationId: "org1", lineGroupId: "grp1" };
const ext = (o: Partial<TripExtraction>) => o as unknown as TripExtraction;

describe("findMatchingTrip", () => {
  it("returns an exact shipment-code match", async () => {
    const admin = fakeAdmin({ exact: [{ id: "t-exact" }] });
    const r = await findMatchingTrip(
      admin,
      ext({ shipmentCode: "VJF6.37", assignmentDate: "2026-07-20", destinationName: "Mukdahan" }),
      ctx,
    );
    expect(r).toMatchObject({
      tripId: "t-exact",
      method: "shipment_group",
      exact: true,
      needsReview: false,
    });
  });

  it("does NOT composite-match a present code that matched no trip (creates its own trip)", async () => {
    // VJF6.36 has no exact match, but a same-day same-destination trip (VJF6.37)
    // exists. The clear code must win: no match → downstream creates a new trip.
    const admin = fakeAdmin({ exact: [], composite: [{ id: "t37" }] });
    const r = await findMatchingTrip(
      admin,
      ext({ shipmentCode: "VJF6.36", assignmentDate: "2026-07-20", destinationName: "Mukdahan" }),
      ctx,
    );
    expect(r.tripId).toBeNull();
    expect(r.method).toBe("none");
    expect(r.needsReview).toBe(false);
  });

  it("still composite-matches when the message has no shipment code", async () => {
    const admin = fakeAdmin({ composite: [{ id: "t37" }] });
    const r = await findMatchingTrip(
      admin,
      ext({ shipmentCode: null, assignmentDate: "2026-07-20", destinationName: "Mukdahan" }),
      ctx,
    );
    expect(r).toMatchObject({ tripId: "t37", method: "composite", needsReview: true });
  });

  it("uses a referenced trip before composite matching", async () => {
    const admin = fakeAdmin({ composite: [{ id: "t37" }] });
    const r = await findMatchingTrip(
      admin,
      ext({ shipmentCode: null, assignmentDate: "2026-07-20", destinationName: "Mukdahan" }),
      { ...ctx, referencedTripId: "t-ref" },
    );
    expect(r).toMatchObject({ tripId: "t-ref", method: "referenced_message", exact: true });
  });

  it("flags duplicate exact-code candidates as ambiguous", async () => {
    const admin = fakeAdmin({ exact: [{ id: "a" }, { id: "b" }] });
    const r = await findMatchingTrip(admin, ext({ shipmentCode: "VJF6.37" }), ctx);
    expect(r).toMatchObject({ needsReview: true, ambiguous: true });
  });
});
