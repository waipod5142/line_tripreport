import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeShipmentCode } from "./normalizers";
import type { TripExtraction } from "@/lib/ai/schemas";

type Admin = ReturnType<typeof createAdminClient>;

export interface MatchContext {
  organizationId: string;
  lineGroupId: string; // uuid of the trip's primary group
  referencedTripId?: string | null; // resolved from a quoted/referenced message
}

export type MatchMethod =
  | "shipment_group"
  | "referenced_message"
  | "composite"
  | "none";

export interface MatchResult {
  tripId: string | null;
  method: MatchMethod;
  exact: boolean;
  needsReview: boolean;
  /** Set when more than one candidate matched — a duplicate-shipment signal. */
  ambiguous: boolean;
}

const NONE: MatchResult = {
  tripId: null,
  method: "none",
  exact: false,
  needsReview: false,
  ambiguous: false,
};

/**
 * Find the trip an extraction belongs to, in PRD §10.5 priority order.
 * Cross-group matching (priority 2) is disabled initially. Strong composite
 * matches are treated as probable and routed to review rather than auto-applied,
 * and are only attempted when the message has no usable shipment code — a clear
 * code that matched nothing is a new shipment, not a probable match.
 */
export async function findMatchingTrip(
  admin: Admin,
  extraction: TripExtraction,
  ctx: MatchContext,
): Promise<MatchResult> {
  const code = normalizeShipmentCode(extraction.shipmentCode);

  // 1) Exact: org + group + normalized shipment code.
  if (code) {
    const { data } = await admin
      .from("trips")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("primary_line_group_id", ctx.lineGroupId)
      .eq("normalized_shipment_code", code);

    if (data && data.length === 1) {
      return { tripId: data[0].id, method: "shipment_group", exact: true, needsReview: false, ambiguous: false };
    }
    if (data && data.length > 1) {
      // Duplicate shipment candidates — human must disambiguate (§10.8).
      return { tripId: data[0].id, method: "shipment_group", exact: false, needsReview: true, ambiguous: true };
    }
  }

  // 3) Explicit quoted/referenced message already linked to a trip.
  if (ctx.referencedTripId) {
    return {
      tripId: ctx.referencedTripId,
      method: "referenced_message",
      exact: true,
      needsReview: false,
      ambiguous: false,
    };
  }

  // 4/5) Probable composite: assignment date + destination. Route to review.
  // Only attempt this when the message carries NO usable shipment code. A present,
  // normalized code that matched no trip above is a genuinely new/distinct shipment
  // (e.g. VJF6.36 vs an existing VJF6.37 — different driver/truck to the same place
  // on the same day). Let it create its own trip instead of probable-matching a
  // differently-coded one.
  if (!code && extraction.assignmentDate && extraction.destinationName) {
    const { data } = await admin
      .from("trips")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("assignment_date", extraction.assignmentDate)
      .ilike("destination_name", extraction.destinationName);

    if (data && data.length >= 1) {
      return {
        tripId: data[0].id,
        method: "composite",
        exact: false,
        needsReview: true,
        ambiguous: data.length > 1,
      };
    }
  }

  return NONE;
}

/** Resolve a referenced/quoted LINE message id to a trip, if one is linked. */
export async function resolveReferencedTrip(
  admin: Admin,
  organizationId: string,
  referencedLineMessageId: string | null | undefined,
): Promise<string | null> {
  if (!referencedLineMessageId) return null;

  const { data: msg } = await admin
    .from("line_messages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("line_message_id", referencedLineMessageId)
    .maybeSingle();
  if (!msg) return null;

  const { data: link } = await admin
    .from("message_trip_links")
    .select("trip_id")
    .eq("message_id", msg.id)
    .limit(1)
    .maybeSingle();

  return link?.trip_id ?? null;
}
