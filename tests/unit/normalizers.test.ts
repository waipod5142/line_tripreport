import { describe, expect, it } from "vitest";
import {
  isValidContainerNumber,
  normalizePhone,
  normalizeRegistration,
  normalizeShipmentCode,
  parseFlexibleDate,
} from "@/lib/trips/normalizers";

describe("normalizeShipmentCode", () => {
  it("uppercases, trims, strips internal whitespace", () => {
    expect(normalizeShipmentCode(" tpl 6.5 ")).toBe("TPL6.5");
    expect(normalizeShipmentCode("tpl6.5")).toBe("TPL6.5");
  });
  it("returns null for empty/nullish", () => {
    expect(normalizeShipmentCode(null)).toBeNull();
    expect(normalizeShipmentCode("   ")).toBeNull();
  });
});

describe("normalizeRegistration", () => {
  it("normalizes spacing and hyphens but keeps province words", () => {
    expect(normalizeRegistration("aya 71 - 6213")).toBe("AYA 71-6213");
    expect(normalizeRegistration("70-8842  Chonburi")).toBe("70-8842 CHONBURI");
  });
});

describe("normalizePhone", () => {
  it("converts Thai leading 0 to +66", () => {
    expect(normalizePhone("081-234-5678")).toBe("+66812345678");
  });
  it("keeps an existing + prefix and handles 66 prefix", () => {
    expect(normalizePhone("+66812345678")).toBe("+66812345678");
    expect(normalizePhone("66812345678")).toBe("+66812345678");
  });
});

describe("isValidContainerNumber", () => {
  it("accepts a valid ISO 6346 number (KACU4524718)", () => {
    expect(isValidContainerNumber("KACU4524718")).toBe(true);
    expect(isValidContainerNumber("kacu 4524718")).toBe(true);
  });
  it("rejects a wrong check digit or malformed input", () => {
    expect(isValidContainerNumber("KACU4524719")).toBe(false);
    expect(isValidContainerNumber("ABC123")).toBe(false);
    expect(isValidContainerNumber(null)).toBe(false);
  });
});

describe("parseFlexibleDate", () => {
  it("parses DD/MM/YYYY", () => {
    expect(parseFlexibleDate("06/07/2026")).toBe("2026-07-06");
    expect(parseFlexibleDate("6-7-2026")).toBe("2026-07-06");
  });
  it("converts a clear Buddhist-Era year to Gregorian", () => {
    expect(parseFlexibleDate("06/07/2569")).toBe("2026-07-06");
  });
  it("accepts ISO and rejects impossible dates", () => {
    expect(parseFlexibleDate("2026-07-06")).toBe("2026-07-06");
    expect(parseFlexibleDate("31/02/2026")).toBeNull();
    expect(parseFlexibleDate("not a date")).toBeNull();
  });
});
