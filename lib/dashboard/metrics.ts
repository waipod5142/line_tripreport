// Pure dashboard logic — types, thresholds and derivations, no I/O.
//
// Deliberately separate from `lib/data/stats.ts`, which is `server-only` and
// does the querying. The rules in here (when is a group "quiet"? when is a
// week-over-week percentage meaningless?) are judgement calls that need tests,
// and tests shouldn't have to boot a server runtime to reach them.

export interface GroupStats {
  id: string;
  name: string;
  status: string;
  total: number;
  today: number;
  last7d: number;
  prior7d: number;
  sendersToday: number;
  senders7d: number;
  texts: number;
  images: number;
  imagesToday: number;
  lastMessageAt: string | null;
  firstMessageAt: string | null;
  /** Bangkok-day counts for the last 7 days, oldest first. */
  spark: { day: string; n: number }[];
  /** Only the stems that actually occur in this group, busiest first. */
  keywords: { stem: string; label: string; n: number }[];
  /** Null when a percentage would be noise — see `trend`. */
  trendPct: number | null;
  isNew: boolean;
}

export type AlertLevel = "red" | "amber" | "neutral";

export interface Alert {
  level: AlertLevel;
  title: string;
  detail: string;
  href?: string;
  cta?: string;
}

export interface DashboardData {
  groups: GroupStats[];
  totals: {
    today: number;
    sendersToday: number;
    imagesToday: number;
    capturing: number;
    groupCount: number;
    /** Mean messages/day over the trailing 14 days, for the "vs avg" readout. */
    dailyAvg: number;
  };
  /** Last 14 Bangkok days across all groups, oldest first. */
  series: { day: string; byGroup: Record<string, number>; total: number }[];
  topSenders: { name: string; group: string; n: number }[];
  keywordTotals: { stem: string; label: string; n: number }[];
  alerts: Alert[];
}

const DAY_MS = 86_400_000;

/** A group silent this long, that is normally busy, is worth flagging. */
export const QUIET_HOURS = 24;
/** Below this daily average, silence is normal and not worth an alert. */
export const QUIET_MIN_DAILY_AVG = 5;
export const SERIES_DAYS = 14;
export const SPARK_DAYS = 7;

/** Bangkok-local YYYY-MM-DD, `offset` days back from `now`. */
export function bangkokDay(offset = 0, now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
    new Date(now - offset * DAY_MS),
  );
}

export function lastDays(n: number, now = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) => bangkokDay(n - 1 - i, now));
}

/**
 * Week-over-week change, or null when the comparison is meaningless.
 *
 * A group that didn't exist a fortnight ago has no prior week to compare with:
 * both DHL groups went 0 → hundreds this week, which is "new", not an infinite
 * increase. Printing a percentage there would be a number nobody can act on.
 */
export function trend(
  r: { prior_7d: number; last_7d: number; first_message_at: string | null },
  now = Date.now(),
): { trendPct: number | null; isNew: boolean } {
  const priorWindowStart = now - 14 * DAY_MS;
  const first = r.first_message_at ? new Date(r.first_message_at).getTime() : null;
  const isNew = first === null || first > priorWindowStart;

  if (isNew || Number(r.prior_7d) === 0) return { trendPct: null, isNew };
  const pct =
    ((Number(r.last_7d) - Number(r.prior_7d)) / Number(r.prior_7d)) * 100;
  return { trendPct: Math.round(pct), isNew: false };
}

/**
 * The archive's real failure mode is silence: a group that is pending, paused,
 * or whose bot was removed just stops appearing, with no error anywhere. These
 * alerts are the only thing that makes that visible.
 *
 * Returned most-urgent-first.
 */
export function deriveAlerts(
  groups: GroupStats[],
  failedAttachments: number,
  now = Date.now(),
): Alert[] {
  const alerts: Alert[] = [];

  const pending = groups.filter((g) => g.status === "pending");
  if (pending.length > 0) {
    alerts.push({
      level: "red",
      title: `${pending.length} group${pending.length > 1 ? "s" : ""} awaiting approval`,
      detail:
        "Messages sent to a pending group are discarded, not stored. Approve it to start capturing.",
      href: "/settings",
      cta: "Approve",
    });
  }

  if (failedAttachments > 0) {
    alerts.push({
      level: "amber",
      title: `${failedAttachments} attachment${failedAttachments > 1 ? "s" : ""} failed to download`,
      detail:
        "LINE deletes media after a few days, so these are most likely gone for good.",
    });
  }

  for (const g of groups) {
    if (g.status !== "active" || !g.lastMessageAt) continue;
    const hours = (now - new Date(g.lastMessageAt).getTime()) / 3_600_000;
    const dailyAvg = g.last7d / 7;
    if (hours >= QUIET_HOURS && dailyAvg >= QUIET_MIN_DAILY_AVG) {
      alerts.push({
        level: "amber",
        title: `${g.name} has been quiet for ${Math.floor(hours)}h`,
        detail: `It normally sees about ${Math.round(dailyAvg)} messages a day. Check the bot is still in the chat.`,
        href: `/messages?group=${g.id}`,
        cta: "Inspect",
      });
    }
  }

  for (const g of groups.filter((x) => x.status === "paused")) {
    alerts.push({
      level: "neutral",
      title: `${g.name} is paused`,
      detail: "Not capturing new messages. Existing history is still searchable.",
      href: "/settings",
      cta: "Resume",
    });
  }

  return alerts;
}
