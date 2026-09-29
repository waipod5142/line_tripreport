import { describe, expect, it } from "vitest";
import {
  extractShipmentNumbers,
  suggestEvents,
  suggestStage,
  suggestedEventRows,
} from "@/lib/shipments/extract";
import {
  currentStage,
  isComplete,
  type StageEvent,
} from "@/lib/shipments/stages";

// Fixtures are real driver/dispatcher phrasings from the archive.

describe("extractShipmentNumbers", () => {
  it("finds the number whatever the driver spells ชิปเม้น as", () => {
    expect(extractShipmentNumbers("รับงาน ตั้งเจริญการค้า ชิปเม้น 1699112 10ไม้")).toEqual(["1699112"]);
    expect(extractShipmentNumbers("ชิปเม้นท์1699572")).toEqual(["1699572"]);
    expect(extractShipmentNumbers("ชิฟเม้น.  1699244. จำนวน")).toEqual(["1699244"]);
  });

  it("returns every distinct number in a multi-shipment message", () => {
    expect(extractShipmentNumbers("1698504=1698922 และ 1698504")).toEqual(["1698504", "1698922"]);
  });

  it("ignores digits inside longer numbers", () => {
    expect(extractShipmentNumbers("โทร 0816995653")).toEqual([]);
    expect(extractShipmentNumbers("ทะเบียน 71-6375")).toEqual([]);
    expect(extractShipmentNumbers("16997021")).toEqual([]);
  });
});

describe("suggestStage", () => {
  it("does not treat the dispatch assignment template as picking", () => {
    const template =
      "จุดขึ้นสินค้า : โอสถสภาอยุธยา\nShipment : 1699736\nประเภทรถ: 10 W\nทะเบียน : 72-1811";
    expect(suggestStage(template)).toBeNull();
    expect(suggestStage("จุดเข้ารับสินค้า : โอสถสภาอยุธยา\nShipment : 1699443")).toBeNull();
  });

  it("does not read the cross-border แจ้งทะเบียนรับงาน posting as unloaded, typos included", () => {
    const posting =
      "แจ้งทะเบียนรับงานกลับ 22/09/2026 มุกดาหาร - อิเล็กโทรลักซ์ ระยอง ลงสินค้า ประตูสี่ 1699112";
    expect(suggestStage(posting)).toBeNull();
    expect(suggestStage(posting.replace("แจ้งทะเบียน", "แจ้งทะบียน"))).toBeNull();
  });

  it.each([
    ["เซนเวนดิ้ง. ปทุมลงเส็รจแล้วครับ. ชิฟเม้นร์. 1694204.", "unloaded"],
    ["ส่งงานซันเวนดิ้งศรีราชาเสร็จแล้วครับ ชิฟเม้นท์ 1693550", "unloaded"],
    ["ลงงาน โกดัง 2 ภัทรพงษ เรียร้อย ชิพเม้น 1690586 พาเรท กลับ 12 ไม้ ครับ", "pallet_pickup"],
  ])("tolerates real typos and spacing: %s → %s", (text, stage) => {
    expect(suggestStage(text)).toBe(stage);
  });

  it("leaves genuinely ambiguous paperwork messages unmatched", () => {
    expect(suggestStage("ส่งบิลพร้อมบิลค่าตักวรรณระยองสาขาปลวกแดง1696990")).toBeNull();
    expect(suggestStage("กลับจาก วรวิช นครปฐมชิปเม้นท์1698237")).toBeNull();
  });

  it("reads ขึ้นเสร็จ (finished loading) as picking", () => {
    expect(
      suggestStage("โอสถสภา โรจนะ ขึ้นเสร็จเรียบร้อยแล้วครับ ชิปเม้น 1698068 ครับ12 ไม้"),
    ).toBe("picking");
  });

  it.each([
    ["ขึ้นสินค้า ร้านวรรณ มาบตาพุด ชิปเม้นท์ 1699349 พาเลท 12 ไม้เรียบร้อยครับ", "picking"],
    ["รับงาน ตั้งเจริญการค้า ชิปเม้น 1699112 เรียบร้อย ครับ", "picking"],
    ["เฮงรุ่งกรุงเทพ พร้อมส่งชิปเม้นท์ 1699442", "departed"],
    ["ถึง นครปฐมไพศาล ชิปเม้น 1699410 12ไม้ เรียบร้อย ครับ", "arrived"],
    ["เอส เค บี โฮเชล ปทุมธานีส่งเสร็จเรียบร้อยครับชิปเม้นท์1699572", "unloaded"],
    ["จบงาน นครปฐมไพศาล ชิปเม้น 1699410 12ไม้ เรียบร้อย ครับ", "unloaded"],
    ["จบงานแมคโคร อยุธยา ชิพเม้น 1699214 พาเรทกลับ 7 ไม้", "pallet_pickup"],
    ["คืนบิล/พาเลท นครปฐมไพศาล ชิปเม้น 1699410 12ไม้ เรียบร้อย ครับ", "pallet_returned"],
    ["กลับจากเอส เค บีโฮเชลปทุมธานีส่งเอกสารคืนพาเลทเรียบร้อยครับ ชิปเม้นท์1699572", "pallet_returned"],
  ])("%s → %s", (text, stage) => {
    expect(suggestStage(text)).toBe(stage);
  });

  it("does not fire on a bare ถึง in the middle of a sentence", () => {
    expect(suggestStage("รบกวนแจ้งเวลาถึงด้วยครับ 1699235")).toBeNull();
  });

  it("returns null for a message that only names a shipment", () => {
    expect(suggestStage("ชิปเม้น 1699235")).toBeNull();
    expect(suggestStage("1698504=1698922")).toBeNull();
  });

  it("takes the furthest filled line of a progress form and skips blanks", () => {
    const form =
      "บริษัท เซ็นทรัล ฟู้ด บางบัวทอง 1699699\nสแตนบาย : พร้อมรับงานคับ\nขึ้นงานเสร็จ : เดินทางครับ\nจบงาน :\nพาเลท : 10 ตัว";
    expect(suggestStage(form)).toBe("departed");

    const done = form.replace("จบงาน :", "จบงาน : โลตัสDCบางบัวทอง");
    expect(suggestStage(done)).toBe("unloaded");
  });
});

describe("suggestEvents", () => {
  it("emits one suggestion per shipment in a multi-shipment return", () => {
    const text =
      "ส่งคืนบิลและพาเลท\n1.งาน สแน็คทูโก DC 2 ชิปเม้นท์ 1699048 พาเลท 11 ไม้\n2.งาน แม็คโคร บางบัวทอง\nชิปเม้นท์ 1699353 พาเลท 9 ไม้\nส่งคืนเรียบร้อยครับ";
    expect(suggestEvents(text)).toEqual([
      { shipmentNo: "1699048", stage: "pallet_returned" },
      { shipmentNo: "1699353", stage: "pallet_returned" },
    ]);
  });

  it("emits nothing when there is a number but no reported stage", () => {
    expect(suggestEvents("ชิปเม้น 1699235")).toEqual([]);
  });

  it("emits nothing when there is a stage but no number", () => {
    expect(suggestEvents("ถึงแล้วครับ")).toEqual([]);
  });
});

describe("currentStage / isComplete", () => {
  const ev = (stage: StageEvent["stage"], status: StageEvent["status"]): StageEvent => ({
    stage,
    status,
    occurredAt: "2026-09-30T02:00:00Z",
  });

  it("ignores suggestions and rejections", () => {
    expect(currentStage([ev("arrived", "suggested"), ev("unloaded", "rejected")])).toBeNull();
  });

  it("is the furthest confirmed stage even when reported out of order", () => {
    expect(currentStage([ev("unloaded", "confirmed"), ev("picking", "confirmed")])).toBe("unloaded");
  });

  it("is complete only when pallets are returned and confirmed", () => {
    expect(isComplete([ev("pallet_pickup", "confirmed")])).toBe(false);
    expect(isComplete([ev("pallet_returned", "suggested")])).toBe(false);
    expect(isComplete([ev("pallet_returned", "confirmed")])).toBe(true);
  });
});

describe("suggestedEventRows", () => {
  const ids = new Map([
    ["1699702", "ship-a"],
    ["1699353", "ship-b"],
  ]);
  const msg = (id: string, text: string | null) => ({ id, text, sentAt: "2026-09-30T03:00:00Z" });

  it("links only shipments that have been imported", () => {
    const rows = suggestedEventRows(
      [msg("m1", "ส่งคืนบิลและพาเลท\nชิปเม้นท์ 1699048 พาเลท 11 ไม้\nชิปเม้นท์ 1699353 พาเลท 9 ไม้")],
      ids,
    );
    expect(rows).toEqual([
      {
        shipment_id: "ship-b",
        line_message_id: "m1",
        stage: "pallet_returned",
        occurred_at: "2026-09-30T03:00:00Z",
      },
    ]);
  });

  it("skips unsent (null) text, assignment templates and number-only messages", () => {
    expect(
      suggestedEventRows(
        [
          msg("m1", null),
          msg("m2", "จุดขึ้นสินค้า : โอสถสภาอยุธยา\nShipment : 1699702"),
          msg("m3", "ชิปเม้น 1699702"),
        ],
        ids,
      ),
    ).toEqual([]);
  });

  it("uses the message's sent time, not the processing time", () => {
    const [row] = suggestedEventRows([msg("m9", "ถึงแล้ว 1699702")], ids);
    expect(row).toMatchObject({ shipment_id: "ship-a", stage: "arrived", occurred_at: "2026-09-30T03:00:00Z" });
  });
});
