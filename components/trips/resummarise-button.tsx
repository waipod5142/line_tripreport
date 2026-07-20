"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { resummariseTripAction } from "@/app/(dashboard)/trips/actions";
import { cn } from "@/lib/utils";

export function ResummariseButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const run = () => {
    setResult(null);
    startTransition(async () => {
      const r = await resummariseTripAction(tripId);
      setResult(r.ok ? { ok: true, msg: "Updated" } : { ok: false, msg: r.error ?? "Failed" });
    });
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1 text-2xs font-medium text-accent hover:text-accent-ink disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        {pending ? "Summarising…" : "Re-summarise"}
      </button>
      {result && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-2xs",
            result.ok ? "text-[var(--st-green)]" : "text-[var(--st-red)]",
          )}
        >
          {result.ok && <Check className="h-3 w-3" />}
          {result.msg}
        </span>
      )}
    </span>
  );
}
