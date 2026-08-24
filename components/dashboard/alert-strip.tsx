import Link from "next/link";
import { AlertTriangle, Info, PauseCircle } from "lucide-react";
import type { Alert, AlertLevel } from "@/lib/dashboard/metrics";

// Renders nothing when everything is healthy — an empty, permanently-green
// "all clear" panel trains people to stop looking at this area.

const HUE: Record<AlertLevel, string> = {
  red: "var(--st-red)",
  amber: "var(--st-amber)",
  neutral: "var(--st-neutral)",
};

const ICON = {
  red: AlertTriangle,
  amber: AlertTriangle,
  neutral: PauseCircle,
} as const;

export function AlertStrip({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {alerts.map((a, i) => {
        const hue = HUE[a.level];
        const Icon = ICON[a.level] ?? Info;
        return (
          <div
            key={`${a.title}-${i}`}
            className="flex items-start gap-3 rounded-md border border-line bg-panel px-4 py-3"
            style={{ borderLeft: `2px solid ${hue}` }}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: hue }} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">{a.title}</div>
              <div className="mt-0.5 text-xs text-muted">{a.detail}</div>
            </div>
            {a.href && (
              <Link
                href={a.href}
                className="shrink-0 text-xs font-medium text-accent hover:text-accent-ink"
              >
                {a.cta ?? "View"} →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
