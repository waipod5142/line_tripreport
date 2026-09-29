import { describe, expect, it } from "vitest";
import { parseCsv, parseDeliveryRange, parsePlanCsv, planDateFromFilename } from "@/lib/shipments/plan-parse";

// Mirrors the customer's sheet: title row, multi-line header, section dividers,
// spacer rows, a freebie row with no vehicle, and a thousands-separated QTY.
const HEADER =
  'Shipping Point Name,"Delivery Date -\nPO Expire\nวันที่ส่งสินค้า -",เวลาลง,Ship-To Party,Ship To Name,City,Province,QTY,Weight Product,Pallet,Total Weight,Shipment,เวลาเข้ารับ,ประเภทรถ,ซัพ,ทะเบียน,ชื่อ,เบอร์โทร';

const PLAN = [
  "แผนรับงานคลังโรจนะ 30/09/2026",
  HEADER,
  "ขึ้นแล้วส่งเลย",
  "RJ: WH-A,30/09 - 30/09,09.00-12.00,400794,บริษัท ซันเวนดิ้ง เทคโนโลยี จำกัด(มหาชน)สาขาระยอง,ศรีราชา,จ.ชลบุรี,800,11.44,10,11.69,1699702,8.00 น.,10W,TSC,70-2662,นิยม แผนมั่น,081-701 5653",
  ",,,,,,,,,,,,,,,,,",
  "ขึ้นค้างส่ง",
  'RJ: WH-A,28/09 - 28/09,09.00-11.30,406519,บริษัท ซันเวนดิ้ง,ยานนาวา,กรุงเทพมหานคร,"1,048",12.13,11.44,12.42,1698761,15.00 น.,10W,TSC,66-2498,บรรพต จันทะบุรี,062-246 7328',
  "RJ: WH-A,29/09 - 05/10,08:00-14:00,401671,บริษัท ซีพี แอ็กซ์ตร้า,ปลวกแดง,จ.ระยอง,823,8.49,8.14,8.69,1699254,15.00 น.,10W,TSC,74-8262,วัลลภ ทวีผ่อง,095-520-5953",
  "RJ: WH-A,21/09 - 21/09,08:00-16:00,103089,บริษัท วรรณมาบยางพร (2022) จำกัด,ปลวกแดง,จ.ระยอง,50,0.42,0.42,0.43,1697953,ของแถม,,,,,",
].join("\r\n");

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded newlines, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,"b,1","c""d"\r\n"x\ny",z\r\n')).toEqual([
      ["a", "b,1", 'c"d'],
      ["x\ny", "z"],
    ]);
  });
});

describe("parseDeliveryRange", () => {
  it("takes the year from the plan date", () => {
    expect(parseDeliveryRange("29/09 - 05/10", "2026-09-30")).toEqual({
      start: "2026-09-29",
      end: "2026-10-05",
    });
  });

  it("rolls over New Year in both directions", () => {
    expect(parseDeliveryRange("30/12 - 02/01", "2026-12-30")).toEqual({
      start: "2026-12-30",
      end: "2027-01-02",
    });
    expect(parseDeliveryRange("29/12 - 29/12", "2027-01-02")).toEqual({
      start: "2026-12-29",
      end: "2026-12-29",
    });
  });

  it("accepts an explicit year, including Buddhist era", () => {
    expect(parseDeliveryRange("30/09/2569", "2026-09-30").start).toBe("2026-09-30");
  });

  it("returns nulls for unreadable input and rejects impossible dates", () => {
    expect(parseDeliveryRange("", "2026-09-30")).toEqual({ start: null, end: null });
    expect(parseDeliveryRange("31/02", "2026-09-30").start).toBeNull();
  });
});

describe("parsePlanCsv", () => {
  const plan = parsePlanCsv(PLAN);
  const by = (no: string) => plan.rows.find((r) => r.shipment_no === no)!;

  it("reads the plan date from the title and finds every shipment", () => {
    expect(plan.planDate).toBe("2026-09-30");
    expect(plan.rows.map((r) => r.shipment_no)).toEqual([
      "1699702",
      "1698761",
      "1699254",
      "1697953",
    ]);
    expect(plan.warnings).toEqual([]);
  });

  it("keeps the section each shipment sits under", () => {
    expect(by("1699702").section).toBe("loaded");
    expect(by("1698761").section).toBe("pending");
  });

  it("maps the fields for 1699702", () => {
    expect(by("1699702")).toMatchObject({
      plan_date: "2026-09-30",
      delivery_date: "2026-09-30",
      delivery_date_end: "2026-09-30",
      time_window: "09.00-12.00",
      ship_to_code: "400794",
      city: "ศรีราชา",
      province: "จ.ชลบุรี",
      qty: 800,
      pallets: 10,
      plate: "70-2662",
      driver_name: "นิยม แผนมั่น",
      driver_phone: "081-701 5653",
    });
  });

  it("strips thousands separators and rounds fractional pallets up", () => {
    expect(by("1698761").qty).toBe(1048);
    expect(by("1698761").pallets).toBe(12);
    expect(by("1699254").pallets).toBe(9);
  });

  it("keeps a freebie row that has no vehicle", () => {
    expect(by("1697953")).toMatchObject({ plate: null, driver_name: null, driver_phone: null });
  });

  it("finds columns by header text, not position", () => {
    const shuffled = "Shipment,ทะเบียน,Delivery Date\n1699702,70-2662,30/09 - 30/09";
    const r = parsePlanCsv(shuffled, "2026-09-30");
    expect(r.rows[0]).toMatchObject({ shipment_no: "1699702", plate: "70-2662", delivery_date: "2026-09-30" });
  });

  it("warns about and skips a bad shipment number, and dedupes with the later row winning", () => {
    const csv = [
      "แผนรับงาน 30/09/2026",
      "Delivery Date,Shipment,ทะเบียน",
      "30/09 - 30/09,12345,70-1111",
      "30/09 - 30/09,1699702,70-2222",
      "30/09 - 30/09,1699702,70-3333",
    ].join("\n");
    const r = parsePlanCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].plate).toBe("70-3333");
    expect(r.warnings).toHaveLength(2);
  });

  it("fails loudly rather than guessing", () => {
    expect(parsePlanCsv("a,b\n1,2").rows).toEqual([]);
    expect(parsePlanCsv("a,b\n1,2").warnings[0]).toMatch(/Shipment/);
    expect(parsePlanCsv("Delivery Date,Shipment\n30/09 - 30/09,1699702").warnings[0]).toMatch(
      /plan date/i,
    );
    expect(parsePlanCsv("แผนรับงาน 30/09/2026\nพาเลท,ทะเบียน\n1,2").warnings[0]).toMatch(/Shipment/);
    expect(parsePlanCsv("แผนรับงาน 30/09/2026\nShipment,ทะเบียน\n1699702,1").warnings[0]).toMatch(
      /Missing required/,
    );
  });
});

// The customer's other export (rojan_warehouse_plan_20260930.csv): no title
// row, no divider rows — the section sits in a leading Status column on every
// row, and the date exists only in the file name.
const STATUS_EXPORT = [
  "Status,Shipping Point Name,Delivery Date - PO Expire วันที่ส่งสินค้า - วันหมดอายุ,เวลาลง,Ship-To Party,Ship To Name,City,Province,QTY,Weight Product,Pallet,Total Weight,Shipment,Checker เวลาเข้ารับ,ประเภทรถ,ซัพ,ทะเบียน,ชื่อ,เบอร์โทร",
  "ขึ้นแล้วส่งเลย,RJ: WH-A,30/09 - 30/09,09.00-12.00,400794,บริษัท ซันเวนดิ้ง เทคโนโลยี จำกัด(มหาชน)สาขาระยอง,ศรีราชา,จ.ชลบุรี,800,11.44,10,11.69,1699702,8.00 น.,10W,TSC,70-2662,นิยม แผนมั่น,081-701 5653",
  "ขึ้นแล้วส่งเลย,RJ: WH-A,30/09 - 30/09,08.00-15.00,408313,บริษัท สแน็คทูโก (ประเทศไทย) จำกัดDC4,คลองหลวง,จ.ปทุมธานี,480,6.86,6,7.01,1698767,8.00 น.,10W,TSC,71-5276,ทักษิณ หลอดทอง,063-646-8213",
  "ขึ้นค้างส่ง,RJ: WH-A,28/09 - 28/09,09.00-11.30,406519,บริษัท ซันเวนดิ้ง เทคโนโลยี จำกัด(มหาชน) สาขาสาธุประดิษฐ์ (00,ยานนาวา,กรุงเทพมหานคร,1048,12.13,11.44,12.42,1698761,15.00 น.,10W,TSC,66-2498,บรรพต จันทะบุรี,062-246 7328",
  "ขึ้นค้างส่ง,RJ: WH-A,01/10 - 01/10,13.00.00,407071,บริษัท เซ็นทรัล เจดี โลจิสติกส์จำกัด Warehouse C,บางเสาธง,จ.สมุทรปราการ,1229,9.95,10.89,10.22,1699740,16.00 น.,10W,TSC,71-6649,วิทูรย์ สุภาพ,061-207-0814",
  "ขึ้นค้างส่ง,RJ: WH-A,21/09 - 21/09,08:00-16:00,103089,บริษัท วรรณมาบยางพร (2022) จำกัด,ปลวกแดง,จ.ระยอง,50,0.42,0.42,0.43,1697953,ของแถม,,,,,",
].join("\n");

describe("status-column export", () => {
  it("needs a plan date from outside the file", () => {
    const r = parsePlanCsv(STATUS_EXPORT);
    expect(r.rows).toEqual([]);
    expect(r.warnings[0]).toMatch(/plan date/i);
  });

  it("imports every row, taking the section from the Status column", () => {
    const r = parsePlanCsv(STATUS_EXPORT, planDateFromFilename("rojan_warehouse_plan_20260930.csv")!);
    expect(r.warnings).toEqual([]);
    expect(r.rows.map((x) => [x.shipment_no, x.section])).toEqual([
      ["1699702", "loaded"],
      ["1698767", "loaded"],
      ["1698761", "pending"],
      ["1699740", "pending"],
      ["1697953", "pending"],
    ]);
    expect(r.rows[0]).toMatchObject({
      plan_date: "2026-09-30",
      delivery_date: "2026-09-30",
      time_window: "09.00-12.00",
      ship_to_code: "400794",
      qty: 800,
      pallets: 10,
      plate: "70-2662",
      driver_name: "นิยม แผนมั่น",
      driver_phone: "081-701 5653",
    });
    expect(r.rows[3]).toMatchObject({ delivery_date: "2026-10-01", pallets: 11 });
  });

  it("never reads a data row's date as the plan date", () => {
    const csv = "Delivery Date,Shipment\n30/09/2026,1699702";
    expect(parsePlanCsv(csv).planDate).toBe("");
  });
});

describe("planDateFromFilename", () => {
  it.each([
    ["rojan_warehouse_plan_20260930.csv", "2026-09-30"],
    ["plan-2026-09-30.csv", "2026-09-30"],
    ["แผน 30-09-2569.csv", "2026-09-30"],
    ["แผน_1.10.2026.csv", "2026-10-01"],
    ["Book1.csv", null],
    ["plan_20261340.csv", null],
    ["export_1699702.csv", null],
  ])("%s → %s", (name, date) => {
    expect(planDateFromFilename(name)).toBe(date);
  });
});
