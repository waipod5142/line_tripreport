import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { processQueue } from "@/lib/ai/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Drain the message-processing queue. Called by the webhook (after()) for low
 * latency and by pg_cron every minute as the reliable backstop. Authenticated
 * with INTERNAL_JOB_SECRET via x-internal-secret or Authorization: Bearer.
 */
async function handle(req: NextRequest) {
  const env = serverEnv();
  if (!authorized(req, env.INTERNAL_JOB_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await processQueue(3);
  return NextResponse.json({ ok: true, ...summary });
}

export const POST = handle;
export const GET = handle;

function authorized(req: NextRequest, secret: string): boolean {
  const header =
    req.headers.get("x-internal-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
