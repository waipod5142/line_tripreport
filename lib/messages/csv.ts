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
  "Text",
  "Attachments",
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
    (m.text ?? "").replace(/\s+/g, " ").trim(),
    attachments,
  ];
}

export function messageToCsvLine(m: LineMessage): string {
  return csvLine(messageToCsvFields(m));
}

/**
 * ASCII slug for a group name, used in the download filename. Thai group names
 * have no useful ASCII form, so anything that reduces to nothing is dropped and
 * the file falls back to the plain dated name rather than something like
 * `messages---2026-08-15.csv`.
 */
export function slugifyGroup(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\p{ASCII}]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * `messages-2026-08-15.csv`, or `messages-hi-tech-logistics-2026-08-15.csv`
 * when the export is scoped to one group — so a folder of exports stays legible
 * without opening them. Dated in Asia/Bangkok to match the displayed times.
 */
export function csvFilename(now: Date, groupName?: string | null): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(now);
  const slug = groupName ? slugifyGroup(groupName) : "";
  return slug ? `messages-${slug}-${date}.csv` : `messages-${date}.csv`;
}
