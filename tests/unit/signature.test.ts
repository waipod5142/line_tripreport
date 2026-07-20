import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyLineSignature } from "@/lib/line/signature";

const SECRET = "test_channel_secret";

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

describe("verifyLineSignature", () => {
  const body = JSON.stringify({ destination: "U123", events: [] });

  it("accepts a correct signature over the exact raw body", () => {
    expect(verifyLineSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects when the body was tampered with after signing", () => {
    const sig = sign(body);
    const tampered = body.replace("U123", "U999");
    expect(verifyLineSignature(tampered, sig, SECRET)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const sig = sign(body, "wrong_secret");
    expect(verifyLineSignature(body, sig, SECRET)).toBe(false);
  });

  it("rejects a missing or empty signature", () => {
    expect(verifyLineSignature(body, null, SECRET)).toBe(false);
    expect(verifyLineSignature(body, "", SECRET)).toBe(false);
  });

  it("rejects when the channel secret is empty", () => {
    expect(verifyLineSignature(body, sign(body), "")).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    expect(verifyLineSignature(body, "abc", SECRET)).toBe(false);
  });

  it("works with a Buffer body identically to a string body", () => {
    const sig = sign(body);
    expect(verifyLineSignature(Buffer.from(body, "utf8"), sig, SECRET)).toBe(true);
  });
});
