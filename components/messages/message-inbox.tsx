"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FileText,
  ImageIcon,
  Link2,
  MapPin,
  MessageSquare,
  RotateCw,
  Search,
  Sticker,
} from "lucide-react";
import { Code } from "@/components/ui/code";
import type { Classification, LineMessage } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const TYPE_ICON = {
  text: MessageSquare,
  image: ImageIcon,
  file: FileText,
  location: MapPin,
  sticker: Sticker,
} as const;

const CLASS_META: Record<Classification, { label: string; hue: string }> = {
  trip_assignment: { label: "Assignment", hue: "var(--st-blue)" },
  trip_update: { label: "Update", hue: "var(--st-accent)" },
  trip_correction: { label: "Correction", hue: "var(--st-amber)" },
  trip_cancellation: { label: "Cancellation", hue: "var(--st-red)" },
  attachment_context: { label: "Attachment", hue: "var(--st-violet)" },
  general_operational_notice: { label: "Notice", hue: "var(--st-teal)" },
  non_operational: { label: "Non-op", hue: "var(--st-neutral)" },
  unknown: { label: "Unknown", hue: "var(--st-neutral)" },
};

const STATUS_HUE: Record<LineMessage["processingStatus"], string> = {
  received: "var(--st-neutral)",
  stored: "var(--st-neutral)",
  queued: "var(--st-blue)",
  processing: "var(--st-blue)",
  processed: "var(--st-green)",
  review_required: "var(--st-red)",
  failed: "var(--st-red)",
};

export function MessageInbox({ messages }: { messages: LineMessage[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      if (type !== "all" && m.messageType !== type) return false;
      if (status !== "all" && m.processingStatus !== status) return false;
      if (!q) return true;
      return [m.text, m.senderName, m.group, m.attachmentName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [messages, query, type, status]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search text, sender, group…"
            className="h-9 w-full rounded border border-line bg-panel pl-8 pr-3 text-sm text-ink placeholder:text-faint focus:border-line-strong focus:bg-canvas focus:outline-none"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 rounded border border-line bg-canvas px-2.5 text-sm text-ink-soft focus:border-line-strong focus:outline-none"
        >
          <option value="all">All types</option>
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="file">File</option>
          <option value="location">Location</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded border border-line bg-canvas px-2.5 text-sm text-ink-soft focus:border-line-strong focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="processed">Processed</option>
          <option value="review_required">Review required</option>
          <option value="queued">Queued</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="mb-2 text-xs text-muted">
        <span className="font-medium text-ink-soft tabular">{filtered.length}</span> of{" "}
        {messages.length} messages
      </div>

      <div className="overflow-hidden rounded-md border border-line">
        <ul className="divide-y divide-line">
          {filtered.map((m) => {
            const Icon = TYPE_ICON[m.messageType];
            const cls = m.classification ? CLASS_META[m.classification] : null;
            return (
              <li key={m.id} className="flex gap-3 px-4 py-3 hover:bg-panel">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel-2 text-muted">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-thai text-sm font-medium text-ink">
                      {m.senderName}
                    </span>
                    <span className="text-2xs text-faint">
                      {m.group.replace("GEOID • ", "")}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-2xs"
                      style={{ color: STATUS_HUE[m.processingStatus] }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: STATUS_HUE[m.processingStatus] }}
                      />
                      {m.processingStatus.replace("_", " ")}
                    </span>
                    <span className="ml-auto font-mono text-2xs tabular text-faint">
                      {formatDateTime(m.sentAt)}
                    </span>
                  </div>

                  {m.text && (
                    <p className="mt-1 font-thai text-sm text-ink-soft">{m.text}</p>
                  )}
                  {m.attachmentName && (
                    <div className="mt-1 inline-flex items-center gap-1.5 rounded border border-line bg-panel px-2 py-1 font-mono text-2xs text-muted">
                      <ImageIcon className="h-3 w-3" /> {m.attachmentName}
                    </div>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {cls && (
                      <span
                        className="rounded px-1.5 py-0.5 text-2xs font-medium"
                        style={{ color: cls.hue, backgroundColor: `${cls.hue}14` }}
                      >
                        {cls.label}
                      </span>
                    )}
                    {m.linkedTripId ? (
                      <Link
                        href={`/trips/${m.linkedTripId}`}
                        className="inline-flex items-center gap-1 text-2xs font-medium text-accent hover:text-accent-ink"
                      >
                        <Link2 className="h-3 w-3" />
                        <Code className="text-2xs">
                          {tripCode(m.linkedTripId)}
                        </Code>
                      </Link>
                    ) : (
                      <button className="inline-flex items-center gap-1 text-2xs font-medium text-muted hover:text-ink">
                        <Link2 className="h-3 w-3" /> Link to trip
                      </button>
                    )}
                    <button className="inline-flex items-center gap-1 text-2xs font-medium text-muted hover:text-ink">
                      <RotateCw className="h-3 w-3" /> Reprocess
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted">
            No messages match these filters.
          </div>
        )}
      </div>
    </div>
  );
}

// Map internal trip id → its shipment code for display.
function tripCode(id: string): string {
  const map: Record<string, string> = {
    "tpl6-5": "TPL6.5",
    "tpl7-1": "TPL7.1",
    "tpl7-2": "TPL7.2",
    "tpl6-9": "TPL6.9",
    "lcb-4488": "LCB4488",
    "mkd-2207": "MKD-2207",
    "draft-7743": "TPL7.3",
  };
  return map[id] ?? id;
}
