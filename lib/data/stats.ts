import "server-only";
import { createClient } from "@/lib/supabase/server";
import { KEYWORD_STEMS, keywordLabel } from "@/lib/messages/keywords";
import {
  deriveAlerts,
  lastDays,
  trend,
  SERIES_DAYS,
  SPARK_DAYS,
  type DashboardData,
  type GroupStats,
} from "@/lib/dashboard/metrics";

// Dashboard reads. All counting happens in Postgres (migration 0013) and goes
// through the RLS server client, so a user only ever sees their own org's
// numbers — the views are `security_invoker`, which is what makes that true.
//
// The judgement calls (quiet thresholds, when a trend is meaningless) live in
// lib/dashboard/metrics.ts so they can be tested without a server runtime.

export type { DashboardData, GroupStats, Alert } from "@/lib/dashboard/metrics";

type StatsRow = {
  line_group_id: string;
  group_name: string | null;
  status: string;
  total: number;
  today: number;
  last_7d: number;
  prior_7d: number;
  senders_7d: number;
  senders_today: number;
  texts: number;
  images: number;
  images_today: number;
  first_message_at: string | null;
  last_message_at: string | null;
};

type DailyRow = { line_group_id: string; day: string; n: number };
type KeywordRow = { line_group_id: string; stem: string; n: number };
type SenderRow = {
  line_member_id: string | null;
  line_members: { display_name: string | null } | null;
  line_groups: { group_name: string | null } | null;
};

/** Cap on the sender tally scan — 7 days of the busiest group is ~2.4k rows. */
const SENDER_SCAN_CAP = 5000;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Call count_keyword_matches().
 *
 * The cast works around a typing bug in @supabase/ssr 0.5.2: its client doesn't
 * propagate the `Args` generic to `.rpc()`, so TypeScript collapses the argument
 * type to `undefined` and rejects every call. The identical call on a plain
 * @supabase/supabase-js client type-checks fine, and the generated types in
 * lib/supabase/types.ts are correct — the wrapper is what's stale.
 *
 * Fix properly by upgrading @supabase/ssr (0.5.2 → 0.7.x), which is a
 * breaking-change review of the auth/middleware path and doesn't belong in this
 * feature. Until then this is the single place that needs the escape hatch;
 * KeywordRow below still pins the result shape.
 */
async function fetchKeywordCounts(
  supabase: SupabaseServerClient,
  stems: string[],
): Promise<KeywordRow[]> {
  // Cast the CLIENT, then call the method on it — pulling `supabase.rpc` out
  // into a variable first detaches it from its receiver, and the internals
  // reach for `this.rest`.
  const client = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  const { data, error } = await client.rpc("count_keyword_matches", {
    p_stems: stems,
  });

  if (error) {
    // Keyword chips are supplementary — a failure here shouldn't take the whole
    // dashboard down, but it shouldn't vanish silently either.
    console.error(
      JSON.stringify({ stage: "keyword_counts", error: error.message }),
    );
    return [];
  }
  return (data ?? []) as KeywordRow[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [statsRes, dailyRes, keywords, sendersRes, failedRes] = await Promise.all([
    supabase
      .from("group_message_stats")
      .select(
        "line_group_id, group_name, status, total, today, last_7d, prior_7d, senders_7d, senders_today, texts, images, images_today, first_message_at, last_message_at",
      ),
    supabase.from("group_daily_counts").select("line_group_id, day, n"),
    fetchKeywordCounts(supabase, KEYWORD_STEMS),
    supabase
      .from("line_messages")
      .select("line_member_id, line_members ( display_name ), line_groups ( group_name )")
      .gte("sent_at", sevenDaysAgo)
      .limit(SENDER_SCAN_CAP),
    supabase
      .from("message_attachments")
      .select("id", { count: "exact", head: true })
      .eq("retrieval_status", "failed"),
  ]);

  if (statsRes.error) throw statsRes.error;
  if (dailyRes.error) throw dailyRes.error;

  const rows = (statsRes.data ?? []) as unknown as StatsRow[];
  const daily = (dailyRes.data ?? []) as unknown as DailyRow[];

  const sparkDays = lastDays(SPARK_DAYS);
  const seriesDays = lastDays(SERIES_DAYS);

  const dailyIndex = new Map<string, number>();
  for (const d of daily) dailyIndex.set(`${d.line_group_id}|${d.day}`, Number(d.n));

  const keywordsByGroup = new Map<string, KeywordRow[]>();
  for (const k of keywords) {
    const list = keywordsByGroup.get(k.line_group_id) ?? [];
    list.push(k);
    keywordsByGroup.set(k.line_group_id, list);
  }

  const groups: GroupStats[] = rows
    .map((r): GroupStats => {
      const id = r.line_group_id;
      return {
        id,
        name: r.group_name?.trim() || "Unnamed group",
        status: r.status,
        total: Number(r.total),
        today: Number(r.today),
        last7d: Number(r.last_7d),
        prior7d: Number(r.prior_7d),
        sendersToday: Number(r.senders_today),
        senders7d: Number(r.senders_7d),
        texts: Number(r.texts),
        images: Number(r.images),
        imagesToday: Number(r.images_today),
        lastMessageAt: r.last_message_at,
        firstMessageAt: r.first_message_at,
        spark: sparkDays.map((day) => ({
          day,
          n: dailyIndex.get(`${id}|${day}`) ?? 0,
        })),
        keywords: (keywordsByGroup.get(id) ?? [])
          .map((k) => ({ stem: k.stem, label: keywordLabel(k.stem), n: Number(k.n) }))
          .filter((k) => k.n > 0)
          .sort((a, b) => b.n - a.n),
        ...trend(r),
      };
    })
    .sort((a, b) => b.today - a.today || b.total - a.total);

  const series = seriesDays.map((day) => {
    const byGroup: Record<string, number> = {};
    let total = 0;
    for (const g of groups) {
      const n = dailyIndex.get(`${g.id}|${day}`) ?? 0;
      byGroup[g.id] = n;
      total += n;
    }
    return { day, byGroup, total };
  });

  const seriesTotal = series.reduce((sum, d) => sum + d.total, 0);

  return {
    groups,
    totals: {
      today: groups.reduce((n, g) => n + g.today, 0),
      sendersToday: groups.reduce((n, g) => n + g.sendersToday, 0),
      imagesToday: groups.reduce((n, g) => n + g.imagesToday, 0),
      capturing: groups.filter((g) => g.status === "active").length,
      groupCount: groups.length,
      dailyAvg: Math.round(seriesTotal / SERIES_DAYS),
    },
    series,
    topSenders: topSenders((sendersRes.data ?? []) as unknown as SenderRow[]),
    keywordTotals: keywordTotals(keywords),
    alerts: deriveAlerts(groups, failedRes.count ?? 0),
  };
}

function topSenders(rows: SenderRow[]): DashboardData["topSenders"] {
  const tally = new Map<string, { name: string; group: string; n: number }>();
  for (const r of rows) {
    if (!r.line_member_id) continue;
    const entry = tally.get(r.line_member_id) ?? {
      name: r.line_members?.display_name ?? "Unknown sender",
      group: r.line_groups?.group_name ?? "—",
      n: 0,
    };
    entry.n += 1;
    tally.set(r.line_member_id, entry);
  }
  return [...tally.values()].sort((a, b) => b.n - a.n).slice(0, 6);
}

function keywordTotals(rows: KeywordRow[]): DashboardData["keywordTotals"] {
  const tally = new Map<string, number>();
  for (const r of rows) tally.set(r.stem, (tally.get(r.stem) ?? 0) + Number(r.n));
  return [...tally.entries()]
    .map(([stem, n]) => ({ stem, label: keywordLabel(stem), n }))
    .filter((k) => k.n > 0)
    .sort((a, b) => b.n - a.n);
}
