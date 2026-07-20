import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { NonRetriableError, processMessageById } from "@/lib/ai/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Process a single message (manual trigger / regression-fixture replay).
 * Authenticated with INTERNAL_JOB_SECRET — never called by the browser.
 * Body: { messageId: string, extractionOverride?: TripExtraction }
 */
export async function POST(req: NextRequest) {
  const env = serverEnv();
  if (!authorized(req, env.INTERNAL_JOB_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const messageId: string | undefined = body?.messageId;
  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("line_messages").update({ processing_status: "processing" }).eq("id", messageId);

  try {
    const result = await processMessageById(messageId, body?.extractionOverride);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (err instanceof NonRetriableError) {
      await admin.from("line_messages").update({ processing_status: "stored", last_error: detail }).eq("id", messageId);
      return NextResponse.json({ error: detail }, { status: 400 });
    }
    await admin.from("line_messages").update({ processing_status: "failed", last_error: detail }).eq("id", messageId);
    return NextResponse.json({ error: "extraction failed", detail }, { status: 502 });
  }
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
