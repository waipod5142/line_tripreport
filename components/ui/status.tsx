import { STATUS_META } from "@/lib/lifecycle";
import type { ReviewStatus, TripStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Small colored dot for a trip status. */
export function StatusDot({ status }: { status: TripStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: meta.hue }}
      aria-hidden
    />
  );
}

/** Clean badge: dot + label, no heavy fill. Default table/inline treatment. */
export function StatusBadge({
  status,
  className,
}: {
  status: TripStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft",
        className,
      )}
    >
      <StatusDot status={status} />
      {meta.labelEn}
    </span>
  );
}

/** Emphasized status for the trip header — soft tinted pill. */
export function StatusPill({ status }: { status: TripStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium"
      style={{ color: meta.hue, backgroundColor: `${meta.hue}14` }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: meta.hue }}
        aria-hidden
      />
      {meta.labelEn}
    </span>
  );
}

const REVIEW_META: Record<
  ReviewStatus,
  { label: string; hue: string }
> = {
  clear: { label: "Clear", hue: "var(--st-green)" },
  in_review: { label: "In review", hue: "var(--st-amber)" },
  review_required: { label: "Review", hue: "var(--st-red)" },
};

export function ReviewBadge({ state }: { state: ReviewStatus }) {
  if (state === "clear") {
    return <span className="text-xs text-faint">—</span>;
  }
  const meta = REVIEW_META[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-2xs font-semibold uppercase"
      style={{ color: meta.hue, backgroundColor: `${meta.hue}14` }}
    >
      {meta.label}
    </span>
  );
}
