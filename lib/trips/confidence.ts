// Confidence policy (PRD §16.2). Thresholds are configurable per organization
// later; these are the initial defaults.

export const AUTO_APPLY_THRESHOLD = 0.9;
export const REVIEW_THRESHOLD = 0.7;

// Fields that must never be silently overwritten once confirmed (PRD §16.2).
export const CRITICAL_FIELDS = new Set([
  "shipmentCode",
  "tractorRegistration",
  "trailerRegistration",
  "driver",
  "originName",
  "destinationName",
  "assignmentDate",
  "plannedDeliveryAt",
  "cancellation",
]);

export type Decision =
  | "auto_apply" // safe to write automatically
  | "apply_event" // apply non-destructive event only (exact match, mid confidence)
  | "review"; // send to the review queue

/**
 * Decide what to do with a proposed change given its confidence and context.
 * Any conflict with a confirmed critical field forces review regardless of
 * confidence.
 */
export function decide(
  confidence: number,
  opts: { exactMatch: boolean; conflictWithConfirmed: boolean },
): Decision {
  if (opts.conflictWithConfirmed) return "review";
  if (confidence >= AUTO_APPLY_THRESHOLD) return "auto_apply";
  if (confidence >= REVIEW_THRESHOLD) {
    return opts.exactMatch ? "apply_event" : "review";
  }
  return "review";
}

export function isCriticalField(field: string): boolean {
  return CRITICAL_FIELDS.has(field);
}
