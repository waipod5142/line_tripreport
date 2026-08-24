import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "ink" | "accent" | "warn";
}) {
  return (
    <div className="rounded-md border border-line bg-canvas p-3.5 shadow-card">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          "mt-1.5 font-mono text-2xl font-semibold tabular",
          tone === "accent" && "text-accent",
          tone === "warn" && "text-[var(--st-amber)]",
          tone === "ink" && "text-ink",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-2xs text-faint">{hint}</div>}
    </div>
  );
}
