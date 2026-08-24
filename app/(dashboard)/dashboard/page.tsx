import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AlertStrip } from "@/components/dashboard/alert-strip";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { GroupActivityCard } from "@/components/dashboard/group-activity-card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { getDashboardData } from "@/lib/data/stats";

// Counts move continuously as the webhook ingests; never serve a cached page.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { groups, totals, series, topSenders, keywordTotals, alerts } =
    await getDashboardData();

  const vsAvg =
    totals.dailyAvg > 0
      ? Math.round(((totals.today - totals.dailyAvg) / totals.dailyAvg) * 100)
      : null;
  const photoPct =
    totals.today === 0 ? 0 : Math.round((totals.imagesToday / totals.today) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Activity across your LINE groups. All times Asia/Bangkok."
      />

      <AlertStrip alerts={alerts} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Messages today"
          value={totals.today}
          tone="accent"
          hint={
            vsAvg === null
              ? undefined
              : `${vsAvg >= 0 ? "▲" : "▼"} ${Math.abs(vsAvg)}% vs 14-day average`
          }
        />
        <StatTile
          label="Senders today"
          value={totals.sendersToday}
          hint={`across ${totals.groupCount} group${totals.groupCount === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Photos today"
          value={totals.imagesToday}
          hint={totals.today > 0 ? `${photoPct}% of all messages` : undefined}
        />
        <StatTile
          label="Capturing"
          value={`${totals.capturing} / ${totals.groupCount}`}
          tone={totals.capturing < totals.groupCount ? "warn" : "ink"}
          hint={
            totals.capturing === totals.groupCount
              ? "all groups healthy"
              : "some groups inactive"
          }
        />
      </div>

      {groups.length === 0 ? (
        <Card>
          <div className="px-4 py-16 text-center">
            <p className="text-sm font-medium text-ink">No groups yet</p>
            <p className="mt-1 text-xs text-muted">
              Add the LINE official account to a group chat, then approve it under{" "}
              <Link href="/settings" className="text-accent hover:text-accent-ink">
                Settings
              </Link>
              .
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Groups"
              action={
                <Link
                  href="/settings"
                  className="text-xs font-medium text-accent hover:text-accent-ink"
                >
                  Manage →
                </Link>
              }
            />
            <div className="divide-y divide-line">
              {groups.map((g) => (
                <GroupActivityCard key={g.id} group={g} />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Daily activity"
              action={<span className="text-xs text-muted">Last 14 days</span>}
            />
            <ActivityChart series={series} groups={groups} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Most active senders"
                action={<span className="text-xs text-muted">Last 7 days</span>}
              />
              <div className="divide-y divide-line">
                {topSenders.length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted">No activity yet.</p>
                )}
                {topSenders.map((s) => (
                  <div
                    key={`${s.name}-${s.group}`}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-thai text-sm text-ink">
                        {s.name}
                      </div>
                      <div className="truncate font-thai text-2xs text-faint">
                        {s.group}
                      </div>
                    </div>
                    <span className="font-mono text-sm tabular text-ink-soft">
                      {s.n}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Keyword matches"
                action={<span className="text-xs text-muted">All time</span>}
              />
              <div className="divide-y divide-line">
                {keywordTotals.length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted">
                    No tracked phrases found yet.
                  </p>
                )}
                {keywordTotals.map((k) => (
                  <div key={k.stem} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="font-thai text-sm text-ink">{k.stem}</span>
                    <span className="text-2xs text-faint">{k.label}</span>
                    <span className="ml-auto font-mono text-sm tabular text-ink-soft">
                      {k.n}
                    </span>
                  </div>
                ))}
              </div>
              <p className="border-t border-line px-4 py-2.5 text-2xs text-faint">
                Plain substring counts over message text — an approximation, not
                extraction.
              </p>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
