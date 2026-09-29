"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, MessageSquare, Phone, Plus, RotateCcw, X } from "lucide-react";
import {
  moveEventStageAction,
  recordStageAction,
  reviewEventAction,
  type EventActionResult,
} from "@/app/(dashboard)/shipments/actions";
import type { ShipmentEventDetail } from "@/lib/data/shipments";
import { STAGES, STAGE_LABELS, stageSummaries, type Stage } from "@/lib/shipments/stages";
import { isoToBangkokLocal } from "@/lib/shipments/time";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { cn, formatDateTime } from "@/lib/utils";

const inputClass =
  "h-8 rounded border border-line bg-canvas px-2 text-xs text-ink-soft focus:border-line-strong focus:outline-none";

/**
 * The six stages top to bottom, each with the evidence behind it. Suggestions
 * are the keyword rules' guesses (amber) until someone confirms, rejects, or
 * moves them to the right stage. Rejected evidence is kept, hidden by default.
 */
export function ShipmentTimeline({
  shipmentId,
  events,
  canManage,
}: {
  shipmentId: string;
  events: ShipmentEventDetail[];
  canManage: boolean;
}) {
  const [showRejected, setShowRejected] = useState(false);
  const summaries = stageSummaries(events);
  const rejectedCount = events.filter((e) => e.status === "rejected").length;

  return (
    <div>
      <ol className="relative">
        {summaries.map((s, i) => {
          const mine = events.filter(
            (e) => e.stage === s.stage && (showRejected || e.status !== "rejected"),
          );
          const { en, th } = STAGE_LABELS[s.stage];
          const last = i === summaries.length - 1;
          return (
            <li key={s.stage} className="relative flex gap-3 pb-5">
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px",
                    s.state === "done" ? "bg-accent" : "bg-line",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-[1] mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-2xs",
                  s.state === "done" && "border-accent bg-accent text-white",
                  s.state === "suggested" &&
                    "border-[var(--st-amber)] bg-canvas text-[var(--st-amber)]",
                  s.state === "none" && "border-line-strong bg-canvas text-faint",
                )}
              >
                {s.state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      s.state === "none" ? "text-muted" : "text-ink",
                    )}
                  >
                    {en}
                  </span>
                  <span className="font-thai text-xs text-faint">{th}</span>
                  {s.at && (
                    <Code muted className="ml-auto text-2xs">
                      {formatDateTime(s.at)}
                    </Code>
                  )}
                </div>
                {s.state === "suggested" && (
                  <div className="text-2xs text-[var(--st-amber)]">Suggested — needs review</div>
                )}
                {mine.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {mine.map((e) => (
                      <EventCard key={e.id} event={e} canManage={canManage} />
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        {canManage && <RecordStage shipmentId={shipmentId} />}
        {rejectedCount > 0 && (
          <button
            onClick={() => setShowRejected((v) => !v)}
            className="ml-auto text-2xs font-medium text-muted hover:text-ink"
          >
            {showRejected ? "Hide" : "Show"} {rejectedCount} rejected
          </button>
        )}
      </div>
    </div>
  );
}

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<EventActionResult>, onOk?: () => void) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Failed");
      else onOk?.();
    });
  };
  return { pending, error, run };
}

const STATUS_STYLE = {
  suggested: { label: "Suggested", hue: "var(--st-amber)" },
  confirmed: { label: "Confirmed", hue: "var(--st-green)" },
  rejected: { label: "Rejected", hue: "var(--st-neutral)" },
} as const;

function EventCard({ event: e, canManage }: { event: ShipmentEventDetail; canManage: boolean }) {
  const { pending, error, run } = useAction();
  const st = STATUS_STYLE[e.status];
  const m = e.message;

  return (
    <li
      className={cn(
        "rounded border border-line bg-canvas px-3 py-2",
        e.status === "suggested" && "border-[var(--st-amber)]/40 bg-[var(--st-amber)]/[0.04]",
        e.status === "rejected" && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs">
        {m ? (
          <MessageSquare className="h-3 w-3 text-faint" />
        ) : (
          <Phone className="h-3 w-3 text-faint" />
        )}
        <span className="font-thai font-medium text-ink-soft">
          {m ? (m.sender ?? "Unknown sender") : "Recorded manually"}
        </span>
        {m?.group && <span className="font-thai text-faint">{m.group}</span>}
        <Code muted className="text-2xs">
          {formatDateTime(e.occurredAt)}
        </Code>
        <span
          className="ml-auto rounded-full px-1.5 py-px font-medium"
          style={{ color: st.hue, backgroundColor: `color-mix(in srgb, ${st.hue} 10%, transparent)` }}
        >
          {st.label}
          {e.source === "manual" && m ? " · moved" : ""}
        </span>
      </div>

      {m &&
        (m.isUnsent || m.text === null ? (
          <p className="mt-1 text-xs italic text-faint">Message was unsent by the driver.</p>
        ) : (
          <p className="mt-1 whitespace-pre-line break-words font-thai text-sm text-ink">
            {m.text}
          </p>
        ))}

      {e.reviewedBy && e.status !== "suggested" && (
        <p className="mt-1 text-2xs text-faint">
          {e.status === "confirmed" ? "Confirmed" : "Rejected"} by {e.reviewedBy}
        </p>
      )}

      {canManage && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {e.status === "suggested" && (
            <>
              <Button
                size="sm"
                variant="primary"
                disabled={pending}
                onClick={() => run(() => reviewEventAction(e.id, "confirmed"))}
              >
                <Check className="h-3.5 w-3.5" /> Confirm
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => reviewEventAction(e.id, "rejected"))}
              >
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
              <select
                aria-label="Wrong stage — move to"
                disabled={pending}
                value=""
                onChange={(ev) =>
                  ev.target.value &&
                  run(() => moveEventStageAction(e.id, ev.target.value as Stage))
                }
                className={inputClass}
              >
                <option value="">Wrong stage…</option>
                {STAGES.filter((s) => s !== e.stage).map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s].en}
                  </option>
                ))}
              </select>
            </>
          )}
          {e.status === "confirmed" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => reviewEventAction(e.id, m ? "suggested" : "rejected"))}
            >
              <RotateCcw className="h-3.5 w-3.5" /> {m ? "Undo" : "Remove"}
            </Button>
          )}
          {e.status === "rejected" && m && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => reviewEventAction(e.id, "suggested"))}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restore
            </Button>
          )}
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" />}
        </div>
      )}
      {error && <p className="mt-1 text-2xs text-[var(--st-red)]">{error}</p>}
    </li>
  );
}

function RecordStage({ shipmentId }: { shipmentId: string }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("picking");
  const [time, setTime] = useState("");
  const { pending, error, run } = useAction();

  if (!open) {
    return (
      <Button
        size="sm"
        onClick={() => {
          // Default to now, set on open (not during render) to avoid a
          // server/client mismatch.
          setTime(isoToBangkokLocal(Date.now()));
          setOpen(true);
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Record a stage
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        aria-label="Stage"
        value={stage}
        onChange={(e) => setStage(e.target.value as Stage)}
        className={inputClass}
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s].en}
          </option>
        ))}
      </select>
      <input
        type="datetime-local"
        aria-label="Time (Bangkok)"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className={cn(inputClass, "font-mono")}
      />
      <Button
        size="sm"
        variant="primary"
        disabled={pending || !time}
        onClick={() => run(() => recordStageAction(shipmentId, stage, time), () => setOpen(false))}
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Save
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <span className="text-2xs text-[var(--st-red)]">{error}</span>}
    </div>
  );
}
