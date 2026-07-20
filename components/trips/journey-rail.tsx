import { JOURNEY_STAGES, STATUS_META } from "@/lib/lifecycle";
import type { TripStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCENT = "var(--accent)";
const LINE = "var(--line-strong)";

function stageFor(status: TripStatus): number | null {
  return STATUS_META[status].stage;
}

/**
 * The journey rail — the product's signature. The trip lifecycle is a real
 * sequence, so showing where a trip sits on it is honest structure, not
 * decoration. Off-path states (draft / cancelled / exception) render muted.
 */
export function JourneyRail({ status }: { status: TripStatus }) {
  const current = stageFor(status);
  const offPath = current === null;
  const meta = STATUS_META[status];

  return (
    <div>
      {offPath && (
        <p className="mb-3 text-xs text-muted">
          Off the standard journey —{" "}
          <span style={{ color: meta.hue }} className="font-medium">
            {meta.labelEn}
          </span>
        </p>
      )}
      <ol className="flex items-start">
        {JOURNEY_STAGES.map((stage, i) => {
          const done = current !== null && i < current;
          const active = current !== null && i === current;
          const dotColor = done || active ? ACCENT : LINE;
          const connectorColor = current !== null && i < current ? ACCENT : LINE;

          return (
            <li
              key={stage.labelEn}
              className="flex flex-1 flex-col items-center text-center"
            >
              <div className="flex w-full items-center">
                <span
                  className="h-[2px] flex-1"
                  style={{
                    backgroundColor: i === 0 ? "transparent" : connectorColor,
                  }}
                />
                <span
                  className={cn(
                    "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full",
                    active && "ring-4",
                  )}
                  style={{
                    backgroundColor: active ? ACCENT : dotColor,
                    color: active ? ("var(--accent-soft)" as string) : undefined,
                    // @ts-expect-error ring color via arbitrary property
                    "--tw-ring-color": "var(--accent-soft)",
                  }}
                  aria-current={active ? "step" : undefined}
                >
                  {done && (
                    <svg viewBox="0 0 10 10" className="h-2 w-2 text-white">
                      <path
                        d="M2 5.2 4 7.2 8 2.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className="h-[2px] flex-1"
                  style={{
                    backgroundColor:
                      i === JOURNEY_STAGES.length - 1
                        ? "transparent"
                        : current !== null && i < current
                          ? ACCENT
                          : LINE,
                  }}
                />
              </div>
              <span
                className={cn(
                  "mt-2 text-2xs leading-tight",
                  active
                    ? "font-semibold text-accent"
                    : done
                      ? "text-ink-soft"
                      : "text-faint",
                )}
              >
                {stage.labelEn}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Compact pips for dense table rows. */
export function JourneyPips({ status }: { status: TripStatus }) {
  const current = stageFor(status);
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden>
      {JOURNEY_STAGES.map((_, i) => {
        const done = current !== null && i <= current;
        return (
          <span
            key={i}
            className="h-1.5 w-3 rounded-sm"
            style={{ backgroundColor: done ? ACCENT : LINE }}
          />
        );
      })}
    </span>
  );
}
