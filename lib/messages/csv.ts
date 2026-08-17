// CSV serialization for the message export. Pure functions, no I/O — the export
// route streams these rows straight to the browser.

import type { LineMessage } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const CSV_HEADERS = [
  "Sent at (Asia/Bangkok)",
  "Sender",
  "Group",
  "Type",
  "Status",
  "Classification",
  "Text",
  "Attachments",
  "Linked trip",
] as const;

/** Excel reads a UTF-8 file as latin-1 without this byte-order mark. */
export const CSV_BOM = "﻿";

/**
 * Quote one field. Beyond RFC 4180 quoting, a leading =, +, - or @ is prefixed
 * with an apostrophe: spreadsheets treat those as formulas, and this data is
 * operator-authored LINE text that we never want Excel to evaluate.
 */
export function escapeCsvValue(value: string | null | undefined): string {
  const s = String(value ?? "");
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function csvLine(fields: readonly (string | null | undefined)[]): string {
  return fields.map(escapeCsvValue).join(",");
}

/** One message as CSV fields, in CSV_HEADERS order. */
export function messageToCsvFields(m: LineMessage): string[] {
  const attachments =
    m.attachments && m.attachments.length > 0
      ? m.attachments.map((a) => a.filename).join(" | ")
      : m.attachmentName ?? "";

  return [
    formatDateTime(m.sentAt),
    m.senderName,
    m.group,
    m.messageType,
    m.processingStatus,
    m.classification ?? "",
    (m.text ?? "").replace(/\s+/g, " ").trim(),
    attachments,
    m.linkedTripId ?? "",
  ];
}

export function messageToCsvLine(m: LineMessage): string {
  return csvLine(messageToCsvFields(m));
}

/** `messages-2026-08-15.csv`, dated in Asia/Bangkok to match displayed times. */
export function csvFilename(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(now);
  return `messages-${parts}.csv`;
}
