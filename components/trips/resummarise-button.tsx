"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { resummariseTripAction } from "@/app/(dashboard)/trips/actions";
import { cn } from "@/lib/utils";

export function ResummariseButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const run = () => {
    setResult(null);
    startTransition(async () => {
      const r = await resummariseTripAction(tripId);
      setResult(
        r.ok
          ? { ok: true, msg: "Updated" }
          : { ok: false, msg: r.error ?? "Failed" },
      );
    });
  };

  return (
    <div className="inline-flex items-center gap-2">
      {result && (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            result.ok ? "text-[var(--st-green)]" : "text-[var(--st-red)]",
          )}
        >
          {result.ok ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          {result.msg}
        </span>
      )}
      <button
        onClick={run}
        disabled={pending}
        className={cn(
          "inline-flex h-8 items-center justify-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
          "border border-line-strong bg-canvas text-ink-soft hover:bg-panel-2 hover:text-ink",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-accent" />
        )}
        {pending ? "Summarising…" : "Re-summarise"}
      </button>
    </div>
  );
}
