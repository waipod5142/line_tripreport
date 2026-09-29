import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { isInternalRequest } from "@/lib/internal-auth";
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
  if (!isInternalRequest(req.headers, env.INTERNAL_JOB_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = typeof body?.limit === "number" ? body.limit : 10;

  const summary = await retrievePendingAttachments(limit);
  return NextResponse.json({ ok: true, ...summary });
}
