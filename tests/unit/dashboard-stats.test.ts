import { describe, expect, it } from "vitest";
import { deriveAlerts, trend, type GroupStats } from "@/lib/dashboard/metrics";
import { KEYWORDS, KEYWORD_STEMS, keywordLabel } from "@/lib/messages/keywords";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOW = new Date("2026-08-18T10:00:00Z").getTime();

const group = (over: Partial<GroupStats> = {}): GroupStats => ({
  id: "g1",
  name: "Hi Tech Logistics",
  status: "active",
  total: 1068,
  today: 37,
  last7d: 204,
  prior7d: 249,
  sendersToday: 3,
  senders7d: 6,
  texts: 258,
  images: 708,
  imagesToday: 20,
  lastMessageAt: new Date(NOW - HOUR).toISOString(),
  firstMessageAt: new Date(NOW - 29 * DAY).toISOString(),
  spark: [],
  keywords: [],
  trendPct: -18,
  isNew: false,
  ...over,
});

describe("trend", () => {
  it("reports week-over-week change for an established group", () => {
    expect(
      trend({
        prior_7d: 249,
        last_7d: 204,
        first_message_at: new Date(NOW - 29 * DAY).toISOString(),
      }),
    ).toEqual({ trendPct: -18, isNew: false });
  });

  it("marks a group younger than the comparison window as new, not up ∞%", () => {
    // Both DHL groups joined this week: 0 → 652 is not a 65200% increase.
    const r = trend({
      prior_7d: 0,
      last_7d: 652,
      first_message_at: new Date(NOW - 1 * DAY).toISOString(),
    });
    expect(r.isNew).toBe(true);
    expect(r.trendPct).toBeNull();
  });

  it("suppresses the percentage when the prior week was empty", () => {
    expect(
      trend({
        prior_7d: 0,
        last_7d: 30,
        first_message_at: new Date(NOW - 60 * DAY).toISOString(),
      }).trendPct,
    ).toBeNull();
  });

  it("treats a group with no messages at all as new", () => {
    expect(trend({ prior_7d: 0, last_7d: 0, first_message_at: null }).isNew).toBe(true);
  });
});

describe("deriveAlerts", () => {
  it("stays silent when everything is healthy", () => {
    expect(deriveAlerts([group()], 0, NOW)).toEqual([]);
  });

  it("raises a red alert for a pending group, because its messages are discarded", () => {
    const alerts = deriveAlerts([group({ status: "pending" })], 0, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("red");
    expect(alerts[0].title).toContain("awaiting approval");
    expect(alerts[0].href).toBe("/settings");
  });

  it("pluralises the pending-group alert", () => {
    const alerts = deriveAlerts(
      [group({ id: "a", status: "pending" }), group({ id: "b", status: "pending" })],
      0,
      NOW,
    );
    expect(alerts[0].title).toBe("2 groups awaiting approval");
  });

  it("flags failed attachments as likely unrecoverable", () => {
    const alerts = deriveAlerts([group()], 3, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("amber");
    expect(alerts[0].title).toBe("3 attachments failed to download");
  });

  it("flags a busy group that has gone quiet", () => {
    const alerts = deriveAlerts(
      [group({ lastMessageAt: new Date(NOW - 30 * HOUR).toISOString() })],
      0,
      NOW,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toContain("quiet for 30h");
  });

  it("does not cry wolf over a low-traffic group", () => {
    // 7 messages a week is one a day — a day of silence means nothing.
    const alerts = deriveAlerts(
      [group({ last7d: 7, lastMessageAt: new Date(NOW - 30 * HOUR).toISOString() })],
      0,
      NOW,
    );
    expect(alerts).toEqual([]);
  });

  it("does not flag a quiet group that is deliberately paused", () => {
    const alerts = deriveAlerts(
      [
        group({
          status: "paused",
          lastMessageAt: new Date(NOW - 30 * HOUR).toISOString(),
        }),
      ],
      0,
      NOW,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("neutral");
    expect(alerts[0].title).toContain("is paused");
  });

  it("orders the most urgent alert first", () => {
    const alerts = deriveAlerts(
      [
        group({ id: "a", status: "pending" }),
        group({ id: "b", lastMessageAt: new Date(NOW - 40 * HOUR).toISOString() }),
      ],
      3,
      NOW,
    );
    expect(alerts[0].level).toBe("red");
    expect(alerts.map((a) => a.level)).toContain("amber");
  });
});

describe("keyword vocabulary", () => {
  const matches = (text: string, stem: string) =>
    text.toLowerCase().includes(stem.toLowerCase());

  it("matches the assignment stem despite the typos in real messages", () => {
    // All four spellings appear in the live archive. Matching the full phrase
    // แจ้งทะเบียนรับงาน finds 113 messages; the stem finds 150.
    const real = [
      "แจ้งทะเบียนรับงาน 17/08/2026 มุกดาหาร - DHL",
      "แจ้งทะบียนรับงาน 02/08/2026 มุกดาหาร - มาเลย์",
      "แจ้งทะเบีบยรับงาน 03/8/2026 แชมป์เปี้ยน",
      "แแจ้งทะเบียนรับงาน 22/07/2026 มาเลย์",
    ];
    for (const text of real) expect(matches(text, "รับงาน")).toBe(true);
    // The full phrase misses the two with a letter dropped or transposed. (The
    // doubled-แ variant still matches, since the correct phrase survives intact
    // from the second character.)
    expect(real.filter((t) => matches(t, "แจ้งทะเบียนรับงาน"))).toHaveLength(2);
  });

  it("matches completion reports from the DHL groups", () => {
    expect(matches("จบงานสาขาถนนศรีอยุธยาครับ", "จบงาน")).toBe(true);
    expect(matches("ส่งงานเดอะมอลล์บางนาครับ", "ส่งงาน")).toBe(true);
  });

  it("is case-insensitive for latin stems", () => {
    expect(matches("Shipment : 1600123", "Shipment")).toBe(true);
    expect(matches("shipment : 1600123", "Shipment")).toBe(true);
  });

  it("excludes ordinary Thai words that would over-count", () => {
    // ถึง / ออก are everyday words and ด่าน sits inside the assignment
    // template rather than marking a customs event — see keywords.ts.
    for (const bad of ["ถึง", "ออก", "ด่าน"]) {
      expect(KEYWORD_STEMS).not.toContain(bad);
    }
  });

  it("keeps stems short enough to survive typos", () => {
    for (const k of KEYWORDS) expect(k.stem.length).toBeLessThanOrEqual(10);
  });

  it("labels every stem, and falls back to the stem itself", () => {
    for (const k of KEYWORDS) expect(keywordLabel(k.stem)).toBe(k.label);
    expect(keywordLabel("ไม่มี")).toBe("ไม่มี");
  });
});
