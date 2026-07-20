import { MessageSquare, PenLine, Server, Zap } from "lucide-react";
import { EVENT_LABELS } from "@/lib/lifecycle";
import type { TripEvent } from "@/lib/types";
import { cn, formatDate, formatTime } from "@/lib/utils";

const SOURCE_ICON = {
  line: MessageSquare,
  manual: PenLine,
  integration: Zap,
  system: Server,
} as const;

const SOURCE_LABEL = {
  line: "LINE",
  manual: "Manual",
  integration: "Integration",
  system: "System",
} as const;

export function EventTimeline({ events }: { events: TripEvent[] }) {
  const ordered = [...events].sort(
    (a, b) =>
      new Date(a.eventAt ?? 0).getTime() - new Date(b.eventAt ?? 0).getTime(),
  );

  return (
    <ol className="relative">
      {ordered.map((e, i) => {
        const Icon = SOURCE_ICON[e.sourceType];
        const last = i === ordered.length - 1;
        const confirmed = e.confirmationStatus === "confirmed";
        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* rail */}
            {!last && (
              <span
                className="absolute left-[13px] top-7 h-full w-px bg-line"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                confirmed
                  ? "border-accent/25 bg-accent-soft text-accent"
                  : "border-line bg-panel text-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium text-ink">
                  {EVENT_LABELS[e.eventType]}
                </span>
                <span className="font-mono text-xs tabular text-muted">
                  {formatDate(e.eventAt)} · {formatTime(e.eventAt)}
                </span>
              </div>
              {e.description && (
                <p className="mt-0.5 text-xs text-ink-soft">{e.description}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-faint">
                <span className="font-thai">“{e.rawLabel}”</span>
                <span className="text-line-strong">·</span>
                <span>{SOURCE_LABEL[e.sourceType]}</span>
                {e.confidence !== null && (
                  <>
                    <span className="text-line-strong">·</span>
                    <span className="tabular">
                      conf {e.confidence.toFixed(2)}
                    </span>
                  </>
                )}
                {!confirmed && (
                  <span className="rounded bg-[var(--st-amber)]/12 px-1 py-px font-medium text-[var(--st-amber)]">
                    unconfirmed
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
