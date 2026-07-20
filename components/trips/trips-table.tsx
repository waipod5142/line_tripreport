"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Download, Search } from "lucide-react";
import { Code } from "@/components/ui/code";
import { JourneyPips } from "@/components/trips/journey-rail";
import { ReviewBadge, StatusBadge } from "@/components/ui/status";
import { STATUS_META } from "@/lib/lifecycle";
import type { Trip, TripStatus } from "@/lib/types";
import { cn, formatDate, formatDateTime, timeAgo } from "@/lib/utils";

type SortKey = "assignmentDate" | "plannedDeliveryAt" | "lastUpdateAt" | "shipmentCode";

const STATUS_OPTIONS: (TripStatus | "all")[] = [
  "all",
  "draft",
  "assigned",
  "at_origin",
  "border_processing",
  "in_transit",
  "arrived",
  "unloading",
  "completed",
  "exception",
];

export function TripsTable({ trips }: { trips: Trip[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TripStatus | "all">("all");
  const [group, setGroup] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastUpdateAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const groups = useMemo(
    () => ["all", ...Array.from(new Set(trips.map((t) => t.lineGroup)))],
    [trips],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = trips.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (group !== "all" && t.lineGroup !== group) return false;
      if (!q) return true;
      const hay = [
        t.shipmentCode,
        t.tractor,
        t.trailer,
        t.driverNameThai,
        t.driverNameEnglish,
        t.driverPhone,
        t.loadedContainer,
        t.emptyContainer,
        t.origin,
        t.destination,
        t.destinationProvince,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    return rows.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        sortKey === "shipmentCode"
          ? String(av).localeCompare(String(bv))
          : new Date(String(av) || 0).getTime() -
            new Date(String(bv) || 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [trips, query, status, group, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const exportCsv = () => {
    const headers = [
      "Assignment date",
      "Shipment code",
      "Tractor",
      "Trailer",
      "Driver (TH)",
      "Origin",
      "Destination",
      "Province",
      "Planned delivery",
      "Status",
      "Latest update",
      "LINE group",
    ];
    const escape = (v: string | null) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((t) =>
      [
        t.assignmentDate,
        t.shipmentCode,
        t.tractor,
        t.trailer,
        t.driverNameThai,
        t.origin,
        t.destination,
        t.destinationProvince,
        t.plannedDeliveryAt,
        STATUS_META[t.status].labelEn,
        t.latestStatusText,
        t.lineGroup,
      ]
        .map(escape)
        .join(","),
    );
    const csv = [headers.map(escape).join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trips-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortButton = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => toggleSort(k)}
      className={cn(
        "inline-flex items-center gap-1 hover:text-ink",
        sortKey === k && "text-ink",
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-60" />
    </button>
  );

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Shipment, plate, container, driver, route…"
            className="h-9 w-full rounded border border-line bg-panel pl-8 pr-3 text-sm text-ink placeholder:text-faint focus:border-line-strong focus:bg-canvas focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TripStatus | "all")}
          className="h-9 rounded border border-line bg-canvas px-2.5 text-sm text-ink-soft focus:border-line-strong focus:outline-none"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : STATUS_META[s].labelEn}
            </option>
          ))}
        </select>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="h-9 rounded border border-line bg-canvas px-2.5 text-sm text-ink-soft focus:border-line-strong focus:outline-none"
        >
          {groups.map((g) => (
            <option key={g} value={g}>
              {g === "all" ? "All groups" : g.replace("GEOID • ", "")}
            </option>
          ))}
        </select>
        <button
          onClick={exportCsv}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-line-strong bg-canvas px-3 text-sm font-medium text-ink-soft hover:bg-panel-2 hover:text-ink"
        >
          <Download className="h-4 w-4" />
          CSV
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>
          <span className="font-medium text-ink-soft tabular">{filtered.length}</span>{" "}
          of {trips.length} trips
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-md border border-line md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-panel text-left text-xs font-medium text-muted">
              <th className="px-3 py-2.5">
                <SortButton label="Date" k="assignmentDate" />
              </th>
              <th className="px-3 py-2.5">
                <SortButton label="Shipment" k="shipmentCode" />
              </th>
              <th className="px-3 py-2.5">Tractor / Trailer</th>
              <th className="px-3 py-2.5">Driver</th>
              <th className="px-3 py-2.5">Route</th>
              <th className="px-3 py-2.5">
                <SortButton label="Planned" k="plannedDeliveryAt" />
              </th>
              <th className="px-3 py-2.5">Journey</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((t) => (
              <tr key={t.id} className="group hover:bg-panel">
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted tabular">
                  {formatDate(t.assignmentDate)}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/trips/${t.id}`}
                    className="font-mono text-sm font-semibold tabular text-ink hover:text-accent"
                  >
                    {t.shipmentCode}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="font-mono text-xs tabular text-ink-soft">
                    {t.tractor ?? "—"}
                  </div>
                  {t.trailer && (
                    <div className="font-mono text-xs tabular text-faint">
                      {t.trailer}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-thai text-sm text-ink-soft">
                  {t.driverNameThai ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-ink-soft">
                  <div>{t.origin}</div>
                  <div className="text-faint">→ {t.destination}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted tabular">
                  {formatDateTime(t.plannedDeliveryAt)}
                </td>
                <td className="px-3 py-2.5">
                  <JourneyPips status={t.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <ReviewBadge state={t.reviewState} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted">
            No trips match these filters.
          </div>
        )}
      </div>

      {/* Mobile card mode */}
      <div className="space-y-2.5 md:hidden">
        {filtered.map((t) => (
          <Link
            key={t.id}
            href={`/trips/${t.id}`}
            className="block rounded-md border border-line bg-canvas p-3 shadow-card active:bg-panel"
          >
            <div className="flex items-center justify-between">
              <Code className="text-sm font-semibold">{t.shipmentCode}</Code>
              <StatusBadge status={t.status} />
            </div>
            <div className="mt-1.5 text-xs text-ink-soft">
              {t.origin} → {t.destination}
            </div>
            <div className="mt-1 font-mono text-xs tabular text-muted">
              {t.tractor ?? "—"}
              {t.driverNameThai ? (
                <span className="font-thai"> · {t.driverNameThai}</span>
              ) : null}
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <JourneyPips status={t.status} />
              <span className="text-2xs text-faint">{timeAgo(t.lastUpdateAt)}</span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-md border border-line px-4 py-10 text-center text-sm text-muted">
            No trips match these filters.
          </div>
        )}
      </div>
    </div>
  );
}
