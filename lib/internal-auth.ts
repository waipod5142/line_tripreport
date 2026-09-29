import "server-only";
import crypto from "node:crypto";

/**
 * Authenticates /api/internal/* jobs with INTERNAL_JOB_SECRET, sent as
 * `x-internal-secret` or `Authorization: Bearer`. Timing-safe comparison.
 */
export function isInternalRequest(headers: Headers, secret: string): boolean {
  const header =
    headers.get("x-internal-secret") ??
    headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
