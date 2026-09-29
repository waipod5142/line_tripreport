// The six stages of a shipment, in the order they happen. Pure — no I/O — so
// the ordering rules can be tested without a database.

export const STAGES = [
  "picking",
  "departed",
  "arrived",
  "unloaded",
  "pallet_pickup",
  "pallet_returned",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, { en: string; th: string }> = {
  picking: { en: "Picking", th: "ขึ้นสินค้า" },
  departed: { en: "Departed warehouse", th: "ออกจากคลัง" },
  arrived: { en: "Arrived at customer", th: "ถึงลูกค้า" },
  unloaded: { en: "Unloaded", th: "ลงสินค้า" },
  pallet_pickup: { en: "Empty pallets picked up", th: "เก็บพาเลท" },
  pallet_returned: { en: "Pallets returned", th: "คืนพาเลท" },
};

export type EventStatus = "suggested" | "confirmed" | "rejected";

export interface StageEvent {
  stage: Stage;
  status: EventStatus;
  occurredAt: string;
}

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/** Stages with at least one confirmed event. Suggestions never count. */
export function completedStages(events: StageEvent[]): Set<Stage> {
  return new Set(events.filter((e) => e.status === "confirmed").map((e) => e.stage));
}

/**
 * The furthest confirmed stage, or null if nothing is confirmed yet. Drivers
 * report out of order (pallets are often confirmed before anyone tags the
 * unload), so this is the highest stage reached, not the latest message.
 */
export function currentStage(events: StageEvent[]): Stage | null {
  let best: Stage | null = null;
  for (const stage of completedStages(events)) {
    if (best === null || stageIndex(stage) > stageIndex(best)) best = stage;
  }
  return best;
}

/** A shipment is complete once its pallets are back at the warehouse. */
export function isComplete(events: StageEvent[]): boolean {
  return completedStages(events).has("pallet_returned");
}

export interface StageSummary {
  stage: Stage;
  /** done = a confirmed event; suggested = only unreviewed suggestions. */
  state: "done" | "suggested" | "none";
  /** Earliest confirmed time (done), or earliest suggestion (suggested). */
  at: string | null;
}

/** One line per stage, in order, for the detail timeline. */
export function stageSummaries(events: StageEvent[]): StageSummary[] {
  const earliest = (xs: StageEvent[]) =>
    xs.reduce<string | null>((min, e) => (min === null || e.occurredAt < min ? e.occurredAt : min), null);

  return STAGES.map((stage) => {
    const mine = events.filter((e) => e.stage === stage);
    const confirmed = mine.filter((e) => e.status === "confirmed");
    if (confirmed.length > 0) return { stage, state: "done", at: earliest(confirmed) };
    const suggested = mine.filter((e) => e.status === "suggested");
    if (suggested.length > 0) return { stage, state: "suggested", at: earliest(suggested) };
    return { stage, state: "none", at: null };
  });
}
