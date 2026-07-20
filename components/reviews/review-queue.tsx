"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import { Code } from "@/components/ui/code";
import {
  acceptReviewAction,
  dismissReviewAction,
} from "@/app/(dashboard)/reviews/actions";
import type { ReviewItem } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

const PRIORITY: Record<
  ReviewItem["priority"],
  { label: string; hue: string }
> = {
  high: { label: "High", hue: "var(--st-red)" },
  medium: { label: "Medium", hue: "var(--st-amber)" },
  low: { label: "Low", hue: "var(--st-neutral)" },
};

export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  const [resolved, setResolved] = useState<Record<string, "accepted" | "dismissed">>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const open = items.filter((i) => !resolved[i.id]);

  const resolve = (
    id: string,
    run: (id: string) => Promise<{ ok: boolean; error?: string }>,
    outcome: "accepted" | "dismissed",
  ) => {
    setBusyId(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    startTransition(async () => {
      const r = await run(id);
      setBusyId(null);
      if (r.ok) {
        setResolved((s) => ({ ...s, [id]: outcome }));
      } else {
        setErrors((e) => ({ ...e, [id]: r.error ?? "Something went wrong." }));
      }
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-xs text-muted">
        <span>
          <span className="font-medium text-ink-soft tabular">{open.length}</span> open
        </span>
        <span className="text-line-strong">·</span>
        <span>
          <span className="tabular">{Object.keys(resolved).length}</span> resolved this
          session
        </span>
      </div>

      {open.length === 0 ? (
        <div className="rounded-md border border-line bg-panel px-4 py-16 text-center">
          <CheckCheck className="mx-auto h-8 w-8 text-[var(--st-green)]" />
          <p className="mt-2 text-sm font-medium text-ink">Queue is clear</p>
          <p className="mt-1 text-xs text-muted">
            Every proposed change has been reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {open.map((item) => {
            const p = PRIORITY[item.priority];
            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-md border border-line bg-canvas shadow-card"
              >
                {/* header */}
                <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-panel px-4 py-2.5">
                  <span
                    className="rounded px-1.5 py-0.5 text-2xs font-semibold uppercase"
                    style={{ color: p.hue, backgroundColor: `${p.hue}14` }}
                  >
                    {p.label}
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {item.reasonLabel}
                  </span>
                  {item.shipmentCandidate && (
                    <Code className="text-xs font-semibold">
                      {item.shipmentCandidate}
                    </Code>
                  )}
                  <span className="ml-auto text-2xs text-faint">
                    {timeAgo(item.createdAt)} · conf{" "}
                    <span className="tabular">{item.confidence.toFixed(2)}</span>
                  </span>
                </div>

                {/* side by side */}
                <div className="grid gap-px bg-line md:grid-cols-2">
                  {/* source */}
                  <div className="bg-canvas p-4">
                    <div className="eyebrow mb-2">Source message</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-thai text-sm font-medium text-ink">
                        {item.senderName}
                      </span>
                      <span className="font-mono text-2xs tabular text-faint">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 font-thai text-sm text-ink-soft">
                      {item.messageText}
                    </p>
                    <div className="mt-2 text-2xs text-faint">
                      {item.group.replace("GEOID • ", "")}
                    </div>
                    <Link
                      href="/messages"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-ink"
                    >
                      View in inbox <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* proposed */}
                  <div className="bg-canvas p-4">
                    <div className="eyebrow mb-2">Proposed changes</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-faint">
                          <th className="pb-1 font-normal">Field</th>
                          <th className="pb-1 font-normal">Current</th>
                          <th className="pb-1 font-normal">Proposed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.proposed.map((c, i) => (
                          <tr key={i} className="border-t border-line">
                            <td className="py-1.5 pr-2 text-muted">{c.field}</td>
                            <td className="py-1.5 pr-2 text-faint">
                              {c.current ?? "—"}
                            </td>
                            <td
                              className={cn(
                                "py-1.5 font-medium",
                                c.proposed ? "text-ink" : "text-[var(--st-red)]",
                              )}
                            >
                              {c.proposed ?? "missing"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* actions */}
                <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
                  <button
                    onClick={() =>
                      resolve(item.id, acceptReviewAction, "accepted")
                    }
                    disabled={busyId === item.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded bg-accent px-3 text-xs font-medium text-white hover:bg-accent-ink disabled:opacity-60"
                  >
                    {busyId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {item.tripId ? "Accept all" : "Accept — create trip"}
                  </button>
                  {item.tripId && (
                    <Link
                      href={`/trips/${item.tripId}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong bg-canvas px-3 text-xs font-medium text-ink-soft hover:bg-panel-2"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open trip
                    </Link>
                  )}
                  {errors[item.id] && (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--st-red)]">
                      <AlertCircle className="h-3.5 w-3.5" /> {errors[item.id]}
                    </span>
                  )}
                  <button
                    onClick={() =>
                      resolve(item.id, dismissReviewAction, "dismissed")
                    }
                    disabled={busyId === item.id}
                    className="ml-auto inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium text-muted hover:bg-panel-2 hover:text-ink disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
