import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import type { GroupStats } from "@/lib/dashboard/metrics";
import { cn, timeAgo } from "@/lib/utils";

// One row per group. Charts are plain divs — two shapes this simple don't
// justify a charting dependency in a repo that has avoided component libraries.

const STATUS_HUE: Record<string, string> = {
  active: "var(--st-green)",
  paused: "var(--st-amber)",
  pending: "var(--st-neutral)",
  blocked: "var(--st-red)",
};

export function GroupActivityCard({ group }: { group: GroupStats }) {
  const hue = STATUS_HUE[group.status] ?? "var(--st-neutral)";
  const media = group.texts + group.images;
  const photoPct = media === 0 ? 0 : Math.round((group.images / media) * 100);

  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-thai text-sm font-medium text-ink">{group.name}</span>
        <span
          className="inline-flex items-center gap-1.5 text-2xs capitalize"
          style={{ color: hue }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hue }} />
          {group.status}
        </span>
        <span className="ml-auto font-mono text-2xs tabular text-faint">
          {timeAgo(group.lastMessageAt)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <div className="font-mono text-2xl font-semibold tabular text-ink">
            {group.today}
          </div>
          <div className="text-2xs text-faint">today</div>
        </div>

        <Sparkline points={group.spark} />

        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm tabular text-ink-soft">
              {group.last7d}
            </span>
            <Trend group={group} />
          </div>
          <div className="text-2xs text-faint">last 7 days</div>
        </div>

        <div>
          <div className="font-mono text-sm tabular text-ink-soft">
            {group.senders7d}
          </div>
          <div className="text-2xs text-faint">
            sender{group.senders7d === 1 ? "" : "s"}
          </div>
        </div>

        <Link
          href={`/messages?group=${group.id}`}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-ink"
        >
          View inbox <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {media > 0 && (
        <div className="mt-3">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-panel-2">
            <div
              className="bg-accent"
              style={{ width: `${photoPct}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-1 text-2xs text-faint">
            {photoPct}% photo · {100 - photoPct}% text
            <span className="text-faint"> · {group.total} captured all time</span>
          </div>
        </div>
      )}

      {group.keywords.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {group.keywords.map((k) => (
            <span
              key={k.stem}
              title={`${k.n} message(s) containing “${k.stem}”`}
              className="inline-flex items-center gap-1 rounded border border-line bg-panel px-1.5 py-0.5 text-2xs"
            >
              <span className="font-thai text-ink-soft">{k.stem}</span>
              <span className="font-mono tabular text-muted">{k.n}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A group that didn't exist a fortnight ago has no comparable prior week —
 * "▲ ∞%" is worse than saying nothing, so show a "new" chip instead.
 */
function Trend({ group }: { group: GroupStats }) {
  if (group.isNew) {
    return (
      <span className="rounded bg-accent-soft px-1 py-0.5 text-2xs font-medium text-accent-ink">
        new
      </span>
    );
  }
  if (group.trendPct === null || group.trendPct === 0) return null;

  const up = group.trendPct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-2xs font-medium",
        up ? "text-[var(--st-green)]" : "text-[var(--st-amber)]",
      )}
      title="vs the previous 7 days"
    >
      <Icon className="h-3 w-3" />
      {Math.abs(group.trendPct)}%
    </span>
  );
}

function Sparkline({ points }: { points: { day: string; n: number }[] }) {
  const peak = Math.max(...points.map((p) => p.n), 1);
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {points.map((p) => (
        <div
          key={p.day}
          title={`${p.day}: ${p.n}`}
          className="w-1.5 rounded-sm bg-accent/70"
          // A zero day still gets a 2px stub, so the gap reads as "no messages"
          // rather than as a rendering fault.
          style={{ height: p.n === 0 ? 2 : `${Math.max(12, (p.n / peak) * 100)}%` }}
        />
      ))}
    </div>
  );
}
