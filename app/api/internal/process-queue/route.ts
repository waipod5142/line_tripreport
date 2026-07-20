import crypto from "node:crypto";
import { NextResponse, after, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { processQueue } from "@/lib/ai/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Trigger a queue drain. Returns 202 immediately and does the (slow) AI work in
 * after(), so the caller's HTTP timeout (pg_cron/pg_net defaults to a few
 * seconds) can't sever processing mid-flight. Runs every minute via pg_cron and
 * on-demand from the webhook. Auth: INTERNAL_JOB_SECRET (x-internal-secret or
 * Authorization: Bearer).
 */
function handle(req: NextRequest) {
  const env = serverEnv();
  if (!authorized(req, env.INTERNAL_JOB_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  after(async () => {
    try {
      const summary = await processQueue();
      console.info(JSON.stringify({ stage: "process-queue", ...summary }));
    } catch (err) {
      console.error(
        JSON.stringify({
          stage: "process-queue",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  });

  return NextResponse.json({ ok: true, triggered: true }, { status: 202 });
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
