import type { DashboardData, GroupStats } from "@/lib/dashboard/metrics";

// 14-day stacked bars, pure CSS. The design language allows one accent, so
// multi-series colour is a deliberate exception: it draws on the existing
// low-chroma status hues rather than introducing a new palette.
export const SERIES_HUES = [
  "var(--accent)",
  "var(--st-blue)",
  "var(--st-teal)",
  "var(--st-violet)",
  "var(--st-amber)",
];

export function ActivityChart({
  series,
  groups,
}: {
  series: DashboardData["series"];
  groups: GroupStats[];
}) {
  const peak = Math.max(...series.map((d) => d.total), 1);

  return (
    <div className="px-4 pb-4 pt-5">
      <div className="flex h-40 items-end gap-1.5">
        {series.map((d) => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="flex w-full flex-col-reverse justify-start"
              style={{ height: `${(d.total / peak) * 100}%` }}
              title={`${d.day} · ${d.total} messages`}
            >
              {groups.map((g, i) => {
                const n = d.byGroup[g.id] ?? 0;
                if (n === 0) return null;
                return (
                  <div
                    key={g.id}
                    style={{
                      height: `${(n / d.total) * 100}%`,
                      backgroundColor: SERIES_HUES[i % SERIES_HUES.length],
                    }}
                    className="w-full first:rounded-t-sm"
                  />
                );
              })}
            </div>
            <span className="font-mono text-[9px] tabular text-faint">
              {d.day.slice(8)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3">
        {groups.map((g, i) => (
          <span key={g.id} className="inline-flex items-center gap-1.5 text-2xs text-muted">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: SERIES_HUES[i % SERIES_HUES.length] }}
            />
            <span className="font-thai">{g.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
