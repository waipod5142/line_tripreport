import crypto from "node:crypto";
import { NextResponse, after, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { verifyLineSignature } from "@/lib/line/signature";
import {
  LineWebhookBodySchema,
  MEDIA_MESSAGE_TYPES,
} from "@/lib/line/webhook-schema";
import { ingestWebhookBody } from "@/lib/line/ingest";
import { retrievePendingAttachments } from "@/lib/line/attachments";
import { processQueue } from "@/lib/ai/queue";

// Must run on the Node runtime (crypto) and never be statically optimized.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const env = serverEnv();

  // 1) Read the EXACT raw body before anything else — signature depends on it.
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  // 2) Verify before trusting a single byte (FR-LINE-002/003).
  if (!verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET)) {
    console.warn(
      JSON.stringify({ correlationId, stage: "verify", outcome: "invalid_signature" }),
    );
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 3) Parse + validate the envelope.
  let parsed;
  try {
    parsed = LineWebhookBodySchema.parse(JSON.parse(rawBody));
  } catch (err) {
    console.warn(
      JSON.stringify({
        correlationId,
        stage: "parse",
        outcome: "invalid_body",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // 4) Store idempotently. Return 2xx fast; heavy work (content fetch, AI) is
  //    left to the async worker. A DB failure returns 500 so LINE redelivers —
  //    the unique webhookEventId makes that replay safe.
  try {
    const summary = await ingestWebhookBody(parsed, parsed.destination);

    // LINE content is ephemeral — fetch media right after responding, so the
    // webhook itself still returns fast (Vercel keeps the function alive).
    const hasMedia = parsed.events.some(
      (e) =>
        e.message &&
        (MEDIA_MESSAGE_TYPES as readonly string[]).includes(e.message.type),
    );
    const hasText = parsed.events.some((e) => e.message?.type === "text");

    if (hasMedia || hasText) {
      after(async () => {
        try {
          if (hasMedia) {
            const r = await retrievePendingAttachments(20);
            console.info(JSON.stringify({ correlationId, stage: "attachments", ...r }));
          }
          if (hasText) {
            // Best-effort immediate processing; pg_cron is the reliable backstop.
            const q = await processQueue();
            console.info(JSON.stringify({ correlationId, stage: "queue", ...q }));
          }
        } catch (err) {
          console.error(
            JSON.stringify({
              correlationId,
              stage: "after",
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      });
    }

    console.info(
      JSON.stringify({ correlationId, stage: "ingest", outcome: "ok", ...summary }),
    );
    return NextResponse.json({ ok: true, correlationId, ...summary }, { status: 200 });
  } catch (err) {
    console.error(
      JSON.stringify({
        correlationId,
        stage: "ingest",
        outcome: "error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return NextResponse.json(
      { error: "processing failed", correlationId },
      { status: 500 },
    );
  }
}

// LINE's console "Verify" button issues a GET; answer it so setup is smooth.
export function GET() {
  return NextResponse.json({ ok: true, service: "line-webhook" });
}
