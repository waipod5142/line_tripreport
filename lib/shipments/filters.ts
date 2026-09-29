// The /shipments URL contract: which plan day, and which stage. Pure — shared
// by the page and its tests. Same shape as lib/messages/filters.ts: parse
// untrusted params into a whitelisted value, never pass them through raw.

import { isStage, type Stage } from "./stages";

/** "not_started" = no confirmed stage yet. */
export type StageFilter = "all" | "not_started" | Stage;

export interface ShipmentFilters {
  /** Plan day (YYYY-MM-DD); null means "the latest uploaded plan". */
  date: string | null;
  stage: StageFilter;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** A real calendar date in YYYY-MM-DD form, or null. */
export function parseIsoDate(raw: string | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw ? raw : null;
}

export function parseShipmentFilters(
  params: Record<string, string | string[] | undefined>,
): ShipmentFilters {
  const stage = first(params.stage);
  return {
    date: parseIsoDate(first(params.date)),
    stage: stage === "not_started" || isStage(stage) ? stage : "all",
  };
}

export function shipmentFiltersToQuery(f: ShipmentFilters): string {
  const q = new URLSearchParams();
  if (f.date) q.set("date", f.date);
  if (f.stage !== "all") q.set("stage", f.stage);
  return q.toString();
}

/** Does a shipment whose furthest confirmed stage is `current` pass the filter? */
export function matchesStage(current: Stage | null, filter: StageFilter): boolean {
  if (filter === "all") return true;
  if (filter === "not_started") return current === null;
  return current === filter;
}
