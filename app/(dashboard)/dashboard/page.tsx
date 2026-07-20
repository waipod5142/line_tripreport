import Link from "next/link";
import { ArrowUpRight, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Code } from "@/components/ui/code";
import { PageHeader } from "@/components/ui/page-header";
import { JourneyPips } from "@/components/trips/journey-rail";
import { ReviewBadge, StatusBadge } from "@/components/ui/status";
import { getReviewItems, getTrips } from "@/lib/mock/data";
import type { TripStatus } from "@/lib/types";
import { cn, formatDate, formatDateTime, timeAgo } from "@/lib/utils";

export default function DashboardPage() {
  const trips = getTrips();
  const reviews = getReviewItems();

  const count = (fn: (s: TripStatus) => boolean) =>
    trips.filter((t) => fn(t.status)).length;

  const stats = [
    { label: "Trips today", value: trips.filter((t) => t.assignmentDate === "2026-07-19").length, tone: "ink" as const },
    { label: "Assigned", value: count((s) => s === "assigned"), tone: "ink" as const },
    { label: "Border", value: count((s) => s === "border_processing"), tone: "ink" as const },
    { label: "In transit", value: count((s) => s === "in_transit"), tone: "accent" as const },
    { label: "Arrived / unloading", value: count((s) => s === "arrived" || s === "unloading" || s === "loading"), tone: "ink" as const },
    { label: "Completed", value: count((s) => s === "completed"), tone: "ink" as const },
    { label: "Exceptions", value: count((s) => s === "exception"), tone: "alert" as const },
    { label: "Awaiting review", value: reviews.length, tone: "warn" as const },
  ];

  const active = trips
    .filter((t) => !["completed", "cancelled"].includes(t.status))
    .sort((a, b) => new Date(b.lastUpdateAt).getTime() - new Date(a.lastUpdateAt).getTime());

  const recent = [...trips]
    .sort((a, b) => new Date(b.lastUpdateAt).getTime() - new Date(a.lastUpdateAt).getTime())
    .slice(0, 5);

  const now = new Date("2026-07-19T14:30:00+07:00").getTime();
  const overdue = trips.filter(
    (t) =>
      t.plannedDeliveryAt &&
      new Date(t.plannedDeliveryAt).getTime() < now &&
      !["completed", "cancelled"].includes(t.status),
  );

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Live state across every active trip. Saturday 19 July 2026."
      />

      {/* Stat readouts */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-md border border-line bg-canvas p-3.5 shadow-card",
              s.tone === "alert" && "border-l-2 border-l-[var(--st-red)]",
              s.tone === "warn" && "border-l-2 border-l-[var(--st-amber)]",
            )}
          >
            <div className="eyebrow">{s.label}</div>
            <div
              className={cn(
                "mt-1.5 font-mono text-2xl font-semibold tabular",
                s.tone === "accent" && "text-accent",
                s.tone === "alert" && "text-[var(--st-red)]",
                s.tone === "ink" && "text-ink",
                s.tone === "warn" && "text-[var(--st-amber)]",
              )}
            >
              {String(s.value).padStart(2, "0")}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active trips */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Active trips"
              action={
                <Link
                  href="/trips"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-ink"
                >
                  All trips <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="divide-y divide-line">
              {active.map((t) => (
                <Link
                  key={t.id}
                  href={`/trips/${t.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-panel"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Code className="font-semibold">{t.shipmentCode}</Code>
                      <ReviewBadge state={t.reviewState} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {t.origin} → {t.destination}
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <JourneyPips status={t.status} />
                  </div>
                  <div className="w-28 shrink-0 text-right">
                    <StatusBadge status={t.status} className="justify-end" />
                    <div className="mt-0.5 text-2xs text-faint">
                      {timeAgo(t.lastUpdateAt)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Attention column */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Needs attention"
              action={
                overdue.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--st-red)]">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    {overdue.length} overdue
                  </span>
                ) : undefined
              }
            />
            <CardBody className="space-y-3">
              {overdue.length === 0 && (
                <p className="text-sm text-muted">Nothing overdue. Good.</p>
              )}
              {overdue.map((t) => (
                <Link
                  key={t.id}
                  href={`/trips/${t.id}`}
                  className="block rounded border border-line p-2.5 hover:bg-panel"
                >
                  <div className="flex items-center justify-between">
                    <Code className="font-semibold">{t.shipmentCode}</Code>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Planned {formatDateTime(t.plannedDeliveryAt)}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--st-red)]">
                    {t.latestStatusText}
                  </div>
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent updates" />
            <div className="divide-y divide-line">
              {recent.map((t) => (
                <Link
                  key={t.id}
                  href={`/trips/${t.id}`}
                  className="block px-4 py-2.5 hover:bg-panel"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Code className="text-xs font-semibold">{t.shipmentCode}</Code>
                    <span className="text-2xs text-faint">{timeAgo(t.lastUpdateAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">
                    {t.latestStatusText}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <p className="mt-6 text-2xs text-faint">
        Showing sample data · assignment dates around {formatDate("2026-07-19")}
      </p>
    </>
  );
}
