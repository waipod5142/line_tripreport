import { describe, expect, it } from "vitest";
import {
  csvFilename,
  csvLine,
  escapeCsvValue,
  messageToCsvFields,
} from "@/lib/messages/csv";
import {
  filtersToQuery,
  parseMessageFilters,
  parsePage,
  pgrstQuote,
} from "@/lib/messages/filters";
import type { LineMessage } from "@/lib/types";

const message = (over: Partial<LineMessage> = {}): LineMessage => ({
  id: "m1",
  lineMessageId: "line-1",
  group: "GEOID • Laem Chabang",
  senderName: "สมชาย",
  messageType: "text",
  text: "รถถึงด่านแล้ว",
  sentAt: "2026-08-15T03:16:45.779Z",
  processingStatus: "processed",
  classification: "trip_update",
  linkedTripId: "trip-9",
  attachmentName: null,
  attachments: [],
  ...over,
});

describe("escapeCsvValue", () => {
  it("wraps every field in quotes and doubles embedded quotes", () => {
    expect(escapeCsvValue('he said "go"')).toBe('"he said ""go"""');
  });

  it("keeps commas and newlines inside the quoted field", () => {
    expect(escapeCsvValue("a,b")).toBe('"a,b"');
    expect(escapeCsvValue("a\nb")).toBe('"a\nb"');
  });

  it("renders null and undefined as an empty field", () => {
    expect(escapeCsvValue(null)).toBe('""');
    expect(escapeCsvValue(undefined)).toBe('""');
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(escapeCsvValue("=1+1")).toBe(`"'=1+1"`);
    expect(escapeCsvValue("+34812345678")).toBe(`"'+34812345678"`);
    expect(escapeCsvValue("-5")).toBe(`"'-5"`);
    expect(escapeCsvValue("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });

  it("leaves ordinary Thai operational text untouched", () => {
    expect(escapeCsvValue("รถถึงด่านแล้ว")).toBe('"รถถึงด่านแล้ว"');
  });
});

describe("messageToCsvFields", () => {
  it("emits the sent time in Asia/Bangkok", () => {
    // 03:16 UTC is 10:16 in Bangkok (UTC+7).
    expect(messageToCsvFields(message())[0]).toBe("15 Aug 2026, 10:16");
  });

  it("collapses newlines in the message body onto one line", () => {
    const fields = messageToCsvFields(message({ text: "line one\n\nline  two" }));
    expect(fields[6]).toBe("line one line two");
  });

  it("joins multiple attachment filenames", () => {
    const fields = messageToCsvFields(
      message({
        attachments: [
          { id: "a", filename: "cn1.jpg", mimeType: "image/jpeg", kind: "image" },
          { id: "b", filename: "do.pdf", mimeType: "application/pdf", kind: "file" },
        ],
      }),
    );
    expect(fields[7]).toBe("cn1.jpg | do.pdf");
  });

  it("falls back to the pending attachment name when nothing is stored yet", () => {
    const fields = messageToCsvFields(
      message({ attachments: [], attachmentName: "retrieving.jpg" }),
    );
    expect(fields[7]).toBe("retrieving.jpg");
  });

  it("blanks a missing classification and trip link", () => {
    const fields = messageToCsvFields(
      message({ classification: null, linkedTripId: null }),
    );
    expect(fields[5]).toBe("");
    expect(fields[8]).toBe("");
  });

  it("produces one CSV record per message", () => {
    expect(csvLine(messageToCsvFields(message()))).toBe(
      '"15 Aug 2026, 10:16","สมชาย","GEOID • Laem Chabang","text","processed","trip_update","รถถึงด่านแล้ว","","trip-9"',
    );
  });
});

describe("csvFilename", () => {
  it("dates the file in Bangkok time, not UTC", () => {
    // 17:30 UTC on the 14th is already the 15th in Bangkok.
    expect(csvFilename(new Date("2026-08-14T17:30:00Z"))).toBe("messages-2026-08-15.csv");
  });
});

describe("parseMessageFilters", () => {
  it("defaults to no filtering", () => {
    expect(parseMessageFilters({})).toEqual({ q: "", type: "all", status: "all" });
  });

  it("keeps whitelisted type and status values", () => {
    expect(parseMessageFilters({ type: "image", status: "failed" })).toEqual({
      q: "",
      type: "image",
      status: "failed",
    });
  });

  it("coerces unknown values to all, so a hand-edited URL can't probe columns", () => {
    expect(parseMessageFilters({ type: "'; drop", status: "admin" })).toEqual({
      q: "",
      type: "all",
      status: "all",
    });
  });

  it("trims and bounds the search term", () => {
    expect(parseMessageFilters({ q: "  TPL6.5  " }).q).toBe("TPL6.5");
    expect(parseMessageFilters({ q: "x".repeat(500) }).q).toHaveLength(200);
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseMessageFilters({ type: ["image", "file"] }).type).toBe("image");
  });
});

describe("parsePage", () => {
  it("defaults to page 1 and rejects junk", () => {
    expect(parsePage({})).toBe(1);
    expect(parsePage({ page: "0" })).toBe(1);
    expect(parsePage({ page: "-3" })).toBe(1);
    expect(parsePage({ page: "abc" })).toBe(1);
    expect(parsePage({ page: "4" })).toBe(4);
  });
});

describe("filtersToQuery", () => {
  it("omits defaults so an unfiltered inbox has a clean URL", () => {
    expect(filtersToQuery({ q: "", type: "all", status: "all" })).toBe("");
    expect(filtersToQuery({ q: "", type: "all", status: "all" }, 1)).toBe("");
  });

  it("round-trips through parseMessageFilters", () => {
    const filters = { q: "TPL 6.5", type: "image", status: "failed" };
    const parsed = parseMessageFilters(
      Object.fromEntries(new URLSearchParams(filtersToQuery(filters, 3))),
    );
    expect(parsed).toEqual(filters);
    expect(parsePage(Object.fromEntries(new URLSearchParams(filtersToQuery(filters, 3))))).toBe(3);
  });
});

describe("pgrstQuote", () => {
  it("quotes so delimiters in a search term can't alter the or() filter", () => {
    // A bare comma would end the filter and start a new condition.
    expect(pgrstQuote("%a,b%")).toBe('"%a,b%"');
    expect(pgrstQuote("%x.eq.1%")).toBe('"%x.eq.1%"');
    expect(pgrstQuote("%(nested)%")).toBe('"%(nested)%"');
  });

  it("backslash-escapes quotes and backslashes", () => {
    expect(pgrstQuote('%say "hi"%')).toBe('"%say \\"hi\\"%"');
    expect(pgrstQuote("%back\\slash%")).toBe('"%back\\\\slash%"');
  });
});
