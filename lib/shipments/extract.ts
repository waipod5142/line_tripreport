// Turns a driver's message into (shipment numbers, suggested stage). These are
// suggestions a person confirms, never facts — see shipment_events.status.
//
// Learned from the real archive (4,042 text messages, 867 carrying a number):
//
// 1. DRIVERS MISSPELL "SHIPMENT". ชิปเม้น, ชิปเม้นท์, ชิพเม้น, ชิฟเม้น all occur,
//    so the number itself is the anchor, not the word beside it.
//
// 2. THE DISPATCH ASSIGNMENT TEMPLATE IS NOT A STAGE EVENT. "จุดขึ้นสินค้า :
//    โอสถสภาอยุธยา | Shipment : … | ทะเบียน : …" says where a truck must go. It
//    contains "ขึ้นสินค้า" but nothing has been picked up, so it suggests nothing.
//
// 3. ONE MESSAGE CAN CARRY SEVERAL SHIPMENTS ("ส่งคืนบิลและพาเลท 1. … 1699048
//    2. … 1699353"), and some drivers post a progress form (สแตนบาย / ขึ้นงานเสร็จ
//    / จบงาน). Lines are judged separately and the furthest stage wins.
//
// 4. LATER STAGES WIN WITHIN A LINE. "จบงาน … พาเรทกลับ" is about pallets even
//    though it says the job is done.

import { stageIndex, type Stage } from "./stages";

/** 7 digits starting 16/17, not embedded in a longer number (phones, ids). */
const SHIPMENT_NO = /(?<!\d)(?:16|17)\d{5}(?!\d)/g;

export function extractShipmentNumbers(text: string): string[] {
  return [...new Set(text.match(SHIPMENT_NO) ?? [])];
}

// Dispatch postings, not driver reports:
//   จุดขึ้นสินค้า / จุดเข้ารับสินค้า — a truck assigned to a pick-up point
//   แจ้งทะเบียนรับงาน — the cross-border assignment (322 in the archive, every
//     one a posting; it mentions ลงสินค้า and would otherwise read as unloaded).
//     Matched on "แจ้งทะ" because it is typed แจ้งทะบียน, แจ้งทะเบีบย, …
const ASSIGNMENT = /จุด(?:ขึ้น|เข้ารับ)สินค้า|แจ้งทะ/;

// Ordered latest stage first; the first hit on a line wins. Stems are short on
// purpose (see lib/messages/keywords.ts) so typos still match. Counts are hits
// over the archive at the time of writing, for calibration.
const RULES: { stage: Stage; test: RegExp }[] = [
  // คืนพาเลท 196 · คืนบิล · ส่งคืน — pallets/bills handed back
  { stage: "pallet_returned", test: /คืนพาเลท|คืนพาเลต|คืนพาเรท|คืนบิล|ส่งคืน/ },
  // เก็บพาเลท 15 (all with a number) · พาเลทกลับ / พาเรท กลับ / พาเลดกลับ
  { stage: "pallet_pickup", test: /เก็บพาเ[ลร]ท|รับพาเลท|พาเ[ลร][ทด]\s*กลับ/ },
  // ลงสินค้า 397 · ลงเสร็จ 83 (also typed ลงเส็รจ) · ลงของ 33 · ลงงาน · ส่งเสร็จ ·
  // ส่งงาน · จบงาน 640
  {
    stage: "unloaded",
    test: /ลงสินค้า|ลงเส(?:ร็|็ร)|ลงของ|ลงงาน|ส่งเสร็จ|ส่งสินค้า|ส่งงาน|จบงาน/,
  },
  // ถึงแล้ว 43 · ถึงหน้า 101 · a line that opens with ถึง ("ถึง นครปฐมไพศาล …").
  // Bare "ถึง" mid-sentence is rejected as everyday Thai.
  { stage: "arrived", test: /ถึงแล้ว|ถึงหน้า|^\s*ถึง(?=\s|[ก-๙])/ },
  // ออกเดินทาง 98 · ออกจาก 75 · เดินทาง (progress form) · พร้อมส่ง
  { stage: "departed", test: /ออกเดินทาง|ออกจาก|ออกแล้ว|เดินทาง|พร้อมส่ง/ },
  // ขึ้นสินค้า 320 · ขึ้นเสร็จ 21 · ขึ้นของ · ขึ้นงาน · โหลด 82 · รับงาน · สแตนบาย
  { stage: "picking", test: /ขึ้นสินค้า|ขึ้นเสร็จ|ขึ้นของ|ขึ้นงาน|โหลด|รับงาน|สแตนบาย/ },
];

/** Progress-form lines like "จบงาน :" with nothing after the colon are blanks. */
function isBlankFormField(line: string): boolean {
  return /[:：]\s*$/.test(line.trim());
}

/** The furthest stage the message reports, or null if it reports none. */
export function suggestStage(text: string): Stage | null {
  if (ASSIGNMENT.test(text)) return null;

  let best: Stage | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (isBlankFormField(line)) continue;
    const rule = RULES.find((r) => r.test.test(line));
    if (rule && (best === null || stageIndex(rule.stage) > stageIndex(best))) {
      best = rule.stage;
    }
  }
  return best;
}

export interface ShipmentSuggestion {
  shipmentNo: string;
  stage: Stage;
}

/** One suggestion per shipment number in the message; empty if no stage is reported. */
export function suggestEvents(text: string): ShipmentSuggestion[] {
  const stage = suggestStage(text);
  if (!stage) return [];
  return extractShipmentNumbers(text).map((shipmentNo) => ({ shipmentNo, stage }));
}

export interface MessageForSuggestion {
  id: string;
  text: string | null;
  sentAt: string;
}

export interface SuggestedEventRow {
  shipment_id: string;
  line_message_id: string;
  stage: Stage;
  occurred_at: string;
}

/**
 * Suggested event rows for a batch of messages. A number that isn't in
 * `shipmentIdByNo` (not imported yet, or another customer's) yields nothing —
 * importing its plan later re-scans the archive, so the report isn't lost.
 */
export function suggestedEventRows(
  messages: MessageForSuggestion[],
  shipmentIdByNo: ReadonlyMap<string, string>,
): SuggestedEventRow[] {
  const rows: SuggestedEventRow[] = [];
  for (const m of messages) {
    if (!m.text) continue;
    for (const { shipmentNo, stage } of suggestEvents(m.text)) {
      const shipmentId = shipmentIdByNo.get(shipmentNo);
      if (shipmentId) {
        rows.push({ shipment_id: shipmentId, line_message_id: m.id, stage, occurred_at: m.sentAt });
      }
    }
  }
  return rows;
}
