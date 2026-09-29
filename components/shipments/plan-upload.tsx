"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, X } from "lucide-react";
import { importPlanAction } from "@/app/(dashboard)/shipments/actions";
import { parsePlanCsv, planDateFromFilename } from "@/lib/shipments/plan-parse";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { formatDate } from "@/lib/utils";

/**
 * Pick the daily plan CSV → preview what will be imported → import. The
 * preview parse here is for the reader only; the server re-parses the file.
 */
export function PlanUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string; hasTitleDate: boolean } | null>(
    null,
  );
  // Used only when the file has no title row: pre-filled from the file name,
  // editable by the dispatcher.
  const [planDate, setPlanDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = file ? parsePlanCsv(file.text, planDate || undefined) : null;

  const reset = () => {
    setFile(null);
    setPlanDate("");
    setError(null);
    if (input.current) input.current.value = "";
  };

  const onPick = async (f: File | undefined) => {
    setError(null);
    if (!f) return reset();
    if (!/\.csv$/i.test(f.name)) {
      reset();
      setError("Choose a .csv file — in Excel: File → Save As → CSV UTF-8.");
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text, hasTitleDate: parsePlanCsv(text).planDate !== "" });
    setPlanDate(planDateFromFilename(f.name) ?? "");
  };

  const onImport = () => {
    if (!file) return;
    startTransition(async () => {
      const r = await importPlanAction(file.text, planDate || undefined);
      if (!r.ok) {
        setError(r.error ?? "Import failed.");
        return;
      }
      reset();
      router.push(`/shipments?date=${r.planDate}`);
    });
  };

  const rows = preview?.rows ?? [];
  const loaded = rows.filter((r) => r.section === "loaded").length;

  return (
    <div className="rounded-md border border-line bg-canvas">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink">Import daily plan</div>
          <div className="text-2xs text-faint">
            แผนรับงาน exported from Excel as <span className="font-mono">CSV UTF-8</span>.
            Re-importing updates existing shipments and keeps their progress.
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        {file ? (
          <>
            <Code muted className="max-w-[220px] truncate text-2xs">
              {file.name}
            </Code>
            <Button size="sm" variant="ghost" onClick={reset} disabled={pending} aria-label="Clear file">
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={onImport}
              disabled={pending || rows.length === 0}
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Import {rows.length} shipment{rows.length === 1 ? "" : "s"}
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => input.current?.click()}>
            <FileUp className="h-3.5 w-3.5" />
            Choose CSV
          </Button>
        )}
      </div>

      {preview && (
        <div className="border-t border-line px-4 py-3 text-xs text-ink-soft">
          {!file?.hasTitleDate && (
            <label className="mb-2 flex flex-wrap items-center gap-2">
              <span>Plan date</span>
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="h-8 rounded border border-line bg-canvas px-2 font-mono text-xs text-ink focus:border-line-strong focus:outline-none"
              />
              <span className="text-2xs text-faint">
                {planDate && planDateFromFilename(file?.name ?? "") === planDate
                  ? "from the file name — no title row in this file"
                  : "this file has no title row with the date"}
              </span>
            </label>
          )}
          {preview.planDate && (
            <p>
              Plan for <span className="font-mono tabular">{formatDate(preview.planDate)}</span>
              {" · "}
              <span className="tabular">{rows.length}</span> shipments
              {rows.length > 0 && (
                <>
                  {" "}(<span className="tabular">{loaded}</span> ขึ้นแล้วส่งเลย,{" "}
                  <span className="tabular">{rows.length - loaded}</span> ขึ้นค้างส่ง)
                </>
              )}
            </p>
          )}
          {preview.warnings.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-2xs text-[var(--st-amber)]">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className="border-t border-line px-4 py-2 text-2xs text-[var(--st-red)]">{error}</div>
      )}
    </div>
  );
}
