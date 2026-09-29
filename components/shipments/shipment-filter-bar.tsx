"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { STAGES, STAGE_LABELS } from "@/lib/shipments/stages";
import {
  shipmentFiltersToQuery,
  type ShipmentFilters,
  type StageFilter,
} from "@/lib/shipments/filters";
import { formatDate } from "@/lib/utils";

const selectClass =
  "h-9 rounded border border-line bg-canvas px-2.5 text-sm text-ink-soft focus:border-line-strong focus:outline-none";

export function ShipmentFilterBar({
  filters,
  planDate,
  planDates,
}: {
  filters: ShipmentFilters;
  /** The plan day actually shown (filters.date may be null = latest). */
  planDate: string;
  planDates: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (next: ShipmentFilters) => {
    const q = shipmentFiltersToQuery(next);
    startTransition(() => router.replace(q ? `/shipments?${q}` : "/shipments", { scroll: false }));
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <select
        aria-label="Plan day"
        value={planDate}
        onChange={(e) => go({ ...filters, date: e.target.value })}
        className={selectClass}
      >
        {planDates.map((d) => (
          <option key={d} value={d}>
            แผน {formatDate(d)}
          </option>
        ))}
      </select>
      <select
        aria-label="Stage"
        value={filters.stage}
        onChange={(e) => go({ ...filters, stage: e.target.value as StageFilter })}
        className={selectClass}
      >
        <option value="all">All stages</option>
        <option value="not_started">Not started</option>
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s].en}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" />}
    </div>
  );
}
