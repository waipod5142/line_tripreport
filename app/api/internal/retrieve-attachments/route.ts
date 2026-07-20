import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { retrievePendingAttachments } from "@/lib/line/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retrieve pending LINE attachments and store them in the private bucket.
 * Authenticated with INTERNAL_JOB_SECRET. Body: { limit?: number }.
 * Also runs automatically after ingestion (see the webhook route).
 */
export async function POST(req: NextRequest) {
  const env = serverEnv();
  if (!authorized(req, env.INTERNAL_JOB_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = typeof body?.limit === "number" ? body.limit : 10;

  const summary = await retrievePendingAttachments(limit);
  return NextResponse.json({ ok: true, ...summary });
}

function authorized(req: NextRequest, secret: string): boolean {
  const header =
    req.headers.get("x-internal-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
