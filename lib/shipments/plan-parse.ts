// Parses the customer's daily plan (แผนรับงานคลังโรจนะ dd/mm/yyyy), exported from
// Excel as CSV, into shipment rows. Pure — no I/O.
//
// The sheet is not a clean table, which is why this is more than a split(","):
//
//   • a title row carries the plan date ("แผนรับงานคลังโรจนะ 30/09/2026")
//   • the header row has multi-line cells ("Delivery Date -\nPO Expire\n…")
//   • black divider rows split the body into ขึ้นแล้วส่งเลย (loaded) and
//     ขึ้นค้างส่ง (pending) — the section is meaningful, so it is kept. Some
//     exports instead drop the dividers and title and add a Status column
//     holding the same words on every row; both layouts are read.
//   • blank spacer rows sit between groups
//   • delivery dates carry no year ("30/09 - 05/10"), so the year comes from the
//     plan date and rolls over across New Year
//   • QTY is thousands-separated ("1,048") and Pallet is fractional (9.85)
//
// Columns are found by header text, not position, so the customer adding or
// reordering a column does not silently shift every field.

import type { TablesInsert } from "@/lib/supabase/types";

export type ParsedShipment = Omit<TablesInsert<"shipments">, "organization_id">;

export interface ParsedPlan {
  /** ISO date (YYYY-MM-DD) taken from the title row, else the fallback. */
  planDate: string;
  rows: ParsedShipment[];
  /** Human-readable problems: skipped rows, duplicates, missing columns. */
  warnings: string[];
}

/** RFC 4180 reader: quoted fields, "" escapes, embedded newlines, CRLF, BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type Column =
  | "deliveryDate"
  | "timeWindow"
  | "shipToCode"
  | "shipToName"
  | "city"
  | "province"
  | "qty"
  | "pallets"
  | "shipmentNo"
  | "plate"
  | "driverName"
  | "driverPhone"
  | "section";

// Order matters: "Ship To Party" must be tried before "Ship To Name".
const HEADERS: [Column, RegExp][] = [
  ["shipmentNo", /^shipment$/i],
  ["section", /^status$|^สถานะ$/i],
  ["deliveryDate", /delivery\s*date/i],
  ["timeWindow", /เวลาลง/],
  ["shipToCode", /ship[-\s]*to\s*party/i],
  ["shipToName", /ship[-\s]*to\s*name/i],
  ["city", /^city$/i],
  ["province", /^province$/i],
  ["qty", /^qty$/i],
  ["pallets", /^pallet$/i],
  ["plate", /ทะเบียน/],
  ["driverName", /^ชื่อ$/],
  ["driverPhone", /เบอร์/],
];

const REQUIRED: Column[] = ["shipmentNo", "deliveryDate"];

export const NO_PLAN_DATE =
  "No plan date found — the file has no title row with dd/mm/yyyy and none in its name. Pick the plan date.";

function clean(s: string | undefined): string | null {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

function iso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

/** Buddhist-era years (2569) appear in Thai exports; the DB stores Gregorian. */
function gregorian(year: number): number {
  return year > 2400 ? year - 543 : year;
}

/** Only rows ABOVE the header count as a title — never a data row's date. */
function planDateFromTitle(titleRows: string[][]): string | null {
  for (const row of titleRows) {
    for (const cell of row) {
      const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(cell);
      if (m) return iso(gregorian(+m[3]), +m[2], +m[1]);
    }
  }
  return null;
}

/**
 * A plan exported without its title row carries the date only in the file
 * name: rojan_warehouse_plan_20260930.csv, plan-2026-09-30.csv, or the Thai
 * habit of day first, แผน 30-09-2569.csv.
 */
export function planDateFromFilename(name: string): string | null {
  const ymd = /(?<!\d)(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})(?!\d)/.exec(name);
  if (ymd) {
    const d = iso(gregorian(+ymd[1]), +ymd[2], +ymd[3]);
    if (d) return d;
  }
  const dmy = /(?<!\d)(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})(?!\d)/.exec(name);
  return dmy ? iso(gregorian(+dmy[3]), +dmy[2], +dmy[1]) : null;
}

/** The sheet's section wording → the stored value. */
function sectionOf(text: string | null): "loaded" | "pending" | null {
  if (!text) return null;
  if (/ขึ้นแล้วส่งเลย/.test(text)) return "loaded";
  if (/ขึ้นค้างส่ง/.test(text)) return "pending";
  return null;
}

/**
 * "30/09 - 05/10" → {start, end}, with the year inferred from the plan date.
 * A month more than six away is read as the adjacent year, so a plan dated
 * 30/12 with a delivery on 02/01 lands in January of the next year.
 */
export function parseDeliveryRange(
  raw: string,
  planDate: string,
): { start: string | null; end: string | null } {
  const [py, pm] = planDate.split("-").map(Number);
  const dates: string[] = [];

  for (const m of raw.matchAll(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g)) {
    const day = +m[1];
    const month = +m[2];
    let year = m[3] ? gregorian(m[3].length === 2 ? 2000 + +m[3] : +m[3]) : py;
    if (!m[3]) {
      if (month - pm > 6) year -= 1;
      else if (pm - month > 6) year += 1;
    }
    const d = iso(year, month, day);
    if (d) dates.push(d);
  }

  const start = dates[0] ?? null;
  let end: string | null = dates[1] ?? start;
  if (start && end && end < start) {
    // Range wrapped past New Year without an explicit year on the end date.
    const [y, m, d] = end.split("-").map(Number);
    end = iso(y + 1, m, d);
  }
  return { start, end };
}

function toInt(raw: string | null, mode: "round" | "ceil" = "round"): number | null {
  if (raw === null) return null;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return mode === "ceil" ? Math.ceil(n) : Math.round(n);
}

export function parsePlanCsv(csv: string, fallbackPlanDate?: string): ParsedPlan {
  const warnings: string[] = [];
  const all = parseCsv(csv);

  const headerIdx = all.findIndex((r) => r.some((c) => /^\s*shipment\s*$/i.test(c)));
  if (headerIdx === -1) {
    return { planDate: "", rows: [], warnings: ['No header row with a "Shipment" column was found.'] };
  }

  // The title row wins; the fallback (file name, or a date the user picked)
  // covers exports that dropped the title.
  const planDate = planDateFromTitle(all.slice(0, headerIdx)) ?? fallbackPlanDate ?? null;
  if (!planDate) {
    return { planDate: "", rows: [], warnings: [NO_PLAN_DATE] };
  }

  const cols = new Map<Column, number>();
  all[headerIdx].forEach((cell, i) => {
    const label = cell.replace(/\s+/g, " ").trim();
    const hit = HEADERS.find(([col, re]) => !cols.has(col) && re.test(label));
    if (hit) cols.set(hit[0], i);
  });

  const missing = REQUIRED.filter((c) => !cols.has(c));
  if (missing.length > 0) {
    return { planDate, rows: [], warnings: [`Missing required column(s): ${missing.join(", ")}.`] };
  }

  const get = (row: string[], col: Column) => {
    const i = cols.get(col);
    return i === undefined ? null : clean(row[i]);
  };

  const rows: ParsedShipment[] = [];
  const seen = new Set<string>();
  let section: "loaded" | "pending" | null = null;

  for (let r = headerIdx + 1; r < all.length; r++) {
    const row = all[r];
    const first = row.find((c) => c.trim() !== "");
    if (first === undefined) continue; // blank spacer

    const shipmentNo = get(row, "shipmentNo");

    // A divider is a section label with no shipment on the row. (Exports that
    // carry the section in a Status column put the same words on every data
    // row, so the label alone must not end the row.)
    const divider = sectionOf(first);
    if (divider && !shipmentNo) {
      section = divider;
      continue;
    }

    if (!shipmentNo || !/^\d{7}$/.test(shipmentNo)) {
      warnings.push(`Row ${r + 1}: skipped — "${shipmentNo ?? ""}" is not a 7-digit shipment number.`);
      continue;
    }
    if (seen.has(shipmentNo)) {
      warnings.push(`Row ${r + 1}: shipment ${shipmentNo} appears twice; the later row wins.`);
      const at = rows.findIndex((x) => x.shipment_no === shipmentNo);
      rows.splice(at, 1);
    }
    seen.add(shipmentNo);

    const { start, end } = parseDeliveryRange(get(row, "deliveryDate") ?? "", planDate);
    if (!start) warnings.push(`Row ${r + 1}: shipment ${shipmentNo} has no readable delivery date.`);

    rows.push({
      shipment_no: shipmentNo,
      plan_date: planDate,
      delivery_date: start,
      delivery_date_end: end,
      time_window: get(row, "timeWindow"),
      ship_to_code: get(row, "shipToCode"),
      ship_to_name: get(row, "shipToName"),
      city: get(row, "city"),
      province: get(row, "province"),
      qty: toInt(get(row, "qty")),
      // Fractional in the sheet (9.85); a partly-used pallet is still a pallet.
      pallets: toInt(get(row, "pallets"), "ceil"),
      plate: get(row, "plate"),
      driver_name: get(row, "driverName"),
      driver_phone: get(row, "driverPhone"),
      section: sectionOf(get(row, "section")) ?? section,
    });
  }

  return { planDate, rows, warnings };
}
