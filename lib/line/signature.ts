import crypto from "node:crypto";

/**
 * Verify a LINE webhook signature (FR-LINE-002).
 *
 * LINE signs the request with HMAC-SHA256 over the EXACT raw request body using
 * the channel secret, base64-encoded, delivered in the `x-line-signature`
 * header. The body must never be re-serialized before this check — always pass
 * the untouched raw body.
 *
 * Uses a constant-time comparison to avoid leaking the signature via timing.
 */
export function verifyLineSignature(
  rawBody: string | Buffer,
  signature: string | null | undefined,
  channelSecret: string,
): boolean {
  if (!signature || !channelSecret) return false;

  const expected = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");

  const given = Buffer.from(signature, "utf8");
  const want = Buffer.from(expected, "utf8");

  // timingSafeEqual throws on length mismatch — guard first (a length
  // difference already means the signature is wrong).
  if (given.length !== want.length) return false;

  return crypto.timingSafeEqual(given, want);
}
