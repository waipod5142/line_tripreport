import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OpenRouterExtractor,
  type ExtractionInput,
} from "@/lib/ai/extractor";
import {
  PROMPT_VERSION,
  SCHEMA_VERSION,
  TripExtractionSchema,
} from "@/lib/ai/schemas";
import { applyExtraction } from "@/lib/trips/apply-extraction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Async processing worker (PRD §8.1 asynchronous responsibilities). Given a
 * stored message id, it builds a bounded context window, runs AI extraction
 * (Zod-validated), records the call, and lets deterministic rules apply the
 * result. Authenticated with INTERNAL_JOB_SECRET — never called by the browser.
 *
 * Body: { messageId: string, extractionOverride?: TripExtraction }
 * The override skips the AI call — used for regression-fixture replay and tests.
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

  const { data: msg, error: msgErr } = await admin
    .from("line_messages")
    .select("id, organization_id, line_group_id, sent_at, text_content, quoted_line_message_id")
    .eq("id", messageId)
    .single();
  if (msgErr || !msg) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }
  if (!msg.organization_id || !msg.line_group_id) {
    return NextResponse.json({ error: "message has no active organization/group" }, { status: 400 });
  }

  await admin.from("line_messages").update({ processing_status: "processing" }).eq("id", msg.id);

  // Organization locale/timezone for date interpretation.
  const { data: org } = await admin
    .from("organizations")
    .select("locale, timezone")
    .eq("id", msg.organization_id)
    .single();

  const input = await buildContext(admin, msg, org?.locale ?? "th-TH", org?.timezone ?? "Asia/Bangkok");
  const inputHash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");

  // ── Extraction: override (replay/test) or a real AI call. ──
  let extraction;
  let provider = "override";
  let model = "override";
  let latencyMs = 0;
  try {
    if (body?.extractionOverride) {
      extraction = TripExtractionSchema.parse(body.extractionOverride);
    } else {
      const result = await new OpenRouterExtractor().extract(input);
      extraction = result.extraction;
      provider = result.provider;
      model = result.model;
      latencyMs = result.latencyMs;
    }
  } catch (err) {
    await recordExtraction(admin, msg, { provider, model, inputHash, extraction: null, status: "failed", latencyMs, error: err });
    await admin.from("line_messages").update({ processing_status: "failed" }).eq("id", msg.id);
    return NextResponse.json(
      { error: "extraction failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  await recordExtraction(admin, msg, { provider, model, inputHash, extraction, status: "succeeded", latencyMs, error: null });

  const result = await applyExtraction(admin, {
    message: {
      id: msg.id,
      organizationId: msg.organization_id,
      lineGroupId: msg.line_group_id,
      sentAt: msg.sent_at,
    },
    extraction,
  });

  return NextResponse.json({ ok: true, provider, model, ...result });
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

type Admin = ReturnType<typeof createAdminClient>;

async function buildContext(
  admin: Admin,
  msg: { id: string; line_group_id: string | null; sent_at: string; text_content: string | null; quoted_line_message_id: string | null; organization_id: string | null },
  locale: string,
  timezone: string,
): Promise<ExtractionInput> {
  // Bounded window of preceding messages from the same group (§16.1).
  const { data: preceding } = await admin
    .from("line_messages")
    .select("text_content, sent_at")
    .eq("line_group_id", msg.line_group_id!)
    .lt("sent_at", msg.sent_at)
    .not("text_content", "is", null)
    .order("sent_at", { ascending: false })
    .limit(8);

  const precedingMessages = (preceding ?? [])
    .reverse()
    .map((m) => m.text_content!)
    .filter(Boolean);

  // Extracted attachment text, if the worker has stored any.
  const { data: attachments } = await admin
    .from("message_attachments")
    .select("extracted_text")
    .eq("line_message_id", msg.id)
    .not("extracted_text", "is", null);
  const attachmentText = (attachments ?? []).map((a) => a.extracted_text!).join("\n\n") || undefined;

  // Quoted message text, if stored.
  let quotedText: string | undefined;
  if (msg.quoted_line_message_id) {
    const { data: quoted } = await admin
      .from("line_messages")
      .select("text_content")
      .eq("line_message_id", msg.quoted_line_message_id)
      .maybeSingle();
    quotedText = quoted?.text_content ?? undefined;
  }

  // Candidate trips from deterministic search (recent trips in this group).
  const { data: trips } = await admin
    .from("trips")
    .select("shipment_code, origin_name, destination_name, status, assignment_date")
    .eq("organization_id", msg.organization_id!)
    .eq("primary_line_group_id", msg.line_group_id!)
    .order("updated_at", { ascending: false })
    .limit(5);
  const candidateTripSummaries = (trips ?? []).map(
    (t) =>
      `${t.shipment_code ?? "?"} | ${t.origin_name ?? "?"} → ${t.destination_name ?? "?"} | ${t.status} | ${t.assignment_date ?? "?"}`,
  );

  return {
    messageText: msg.text_content ?? "",
    attachmentText,
    quotedText,
    precedingMessages,
    candidateTripSummaries,
    locale,
    timezone,
  };
}

async function recordExtraction(
  admin: Admin,
  msg: { id: string; organization_id: string | null },
  p: {
    provider: string;
    model: string;
    inputHash: string;
    extraction: unknown;
    status: string;
    latencyMs: number;
    error: unknown;
  },
): Promise<void> {
  await admin.from("ai_extractions").upsert(
    {
      organization_id: msg.organization_id!,
      message_id: msg.id,
      provider: p.provider,
      model: p.model,
      prompt_version: PROMPT_VERSION,
      schema_version: SCHEMA_VERSION,
      input_hash: p.inputHash,
      output_json: (p.extraction ?? null) as never,
      overall_confidence: overallOf(p.extraction),
      status: p.status,
      latency_ms: p.latencyMs,
      error_message: p.error instanceof Error ? p.error.message : p.error ? String(p.error) : null,
    },
    { onConflict: "message_id,input_hash,prompt_version,model", ignoreDuplicates: false },
  );
}

function overallOf(extraction: unknown): number | null {
  if (extraction && typeof extraction === "object" && "confidence" in extraction) {
    const c = (extraction as { confidence?: { overall?: number } }).confidence;
    return c?.overall ?? null;
  }
  return null;
}
