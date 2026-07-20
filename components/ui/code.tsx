import { cn } from "@/lib/utils";

/**
 * Operational identifiers — shipment codes, container numbers, plates,
 * timestamps — set in mono. The product's whole job is extracting these
 * structured codes from chat, so we treat them as first-class objects.
 */
export function Code({
  children,
  className,
  muted,
}: {
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono tabular text-[0.9em] tracking-tight",
        muted ? "text-muted" : "text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A code shown as a subtle bordered chip, for plates / container numbers. */
export function CodeChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-xs tabular tracking-tight text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}
