// The dashboard's keyword vocabulary.
//
// These are plain substring counts over message text — an approximation, not
// extraction. The UI labels them "keyword matches" for exactly that reason:
// nothing here can tell a completion report from the same characters appearing
// in an unrelated sentence.
//
// Two rules learned from measuring the real archive (1,748 messages):
//
// 1. MATCH SHORT STEMS, NOT FULL PHRASES. The exact phrase "แจ้งทะเบียนรับงาน"
//    matches 113 messages; the stem "รับงาน" matches 150. The 37-message gap is
//    misspellings the dispatchers actually type — แจ้งทะบียนรับงาน,
//    แจ้งทะเบีบยรับงาน, แแจ้งทะเบียนรับงาน. Stems survive typos; long phrases
//    silently undercount by a quarter.
//
// 2. AVOID ORDINARY WORDS. "ถึง" (120 hits) and "ออก" (47) are everyday Thai
//    that turn up mid-sentence, and "ด่าน" (113) turned out to sit inside the
//    assignment template rather than marking a customs event — its count was
//    identical to the assignment count. All three were rejected: they produce
//    confident-looking numbers that mean nothing.
//
// Groups speak different dialects — Hi Tech Logistics is an assignment channel
// (รับงาน), the two DHL groups are completion channels (จบงาน) — so each group
// card shows only the stems that actually occur in it.
//
// To add a phrase: append to this array. No migration needed; the stems are
// passed to count_keyword_matches() at query time.

export interface Keyword {
  /** Substring matched case-insensitively against text_content. Keep it short. */
  stem: string;
  /** English label shown beside the count. */
  label: string;
}

export const KEYWORDS: Keyword[] = [
  { stem: "รับงาน", label: "Job assigned" },
  { stem: "จบงาน", label: "Job completed" },
  { stem: "ส่งงาน", label: "Delivered" },
  { stem: "ยกเลิก", label: "Cancelled" },
  { stem: "Shipment", label: "Shipment ref" },
];

export const KEYWORD_STEMS = KEYWORDS.map((k) => k.stem);

const LABELS = new Map(KEYWORDS.map((k) => [k.stem, k.label]));

export function keywordLabel(stem: string): string {
  return LABELS.get(stem) ?? stem;
}
