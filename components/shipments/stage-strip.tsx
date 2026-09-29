import { STAGES, STAGE_LABELS, completedStages, type StageEvent } from "@/lib/shipments/stages";
import { cn } from "@/lib/utils";

/**
 * Six segments, one per stage. Solid = confirmed; outlined = a keyword rule has
 * suggested it and nobody has decided yet; empty = no evidence. Suggestions are
 * shown so they get reviewed, never counted as progress.
 */
export function StageStrip({ events }: { events: StageEvent[] }) {
  const done = completedStages(events);
  const suggested = new Set(
    events.filter((e) => e.status === "suggested").map((e) => e.stage),
  );

  return (
    <div className="flex gap-0.5" role="list" aria-label="Shipment stages">
      {STAGES.map((stage) => {
        const state = done.has(stage) ? "done" : suggested.has(stage) ? "suggested" : "none";
        const { en, th } = STAGE_LABELS[stage];
        return (
          <span
            key={stage}
            role="listitem"
            title={`${en} · ${th} — ${state === "done" ? "confirmed" : state === "suggested" ? "suggested, needs review" : "no report"}`}
            className={cn(
              "h-2 w-5 rounded-[2px] border",
              state === "done" && "border-accent bg-accent",
              state === "suggested" && "border-[var(--st-amber)] bg-[var(--st-amber)]/15",
              state === "none" && "border-line bg-panel-2",
            )}
          />
        );
      })}
    </div>
  );
}
