import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyExtraction } from "@/lib/trips/apply-extraction";
import { OpenRouterExtractor, type ExtractionInput } from "./extractor";
import { PROMPT_VERSION, SCHEMA_VERSION, TripExtractionSchema } from "./schemas";

type Admin = ReturnType<typeof createAdminClient>;

/** Errors that should not be retried (bad input, missing data). */
export class NonRetriableError extends Error {}

export interface ProcessOutcome {
  provider: string;
  model: string;
  action: string;
  tripId: string | null;
  reviewItemId: string | null;
  eventsAdded: number;
}

/**
 * Process one message end-to-end: build context → AI extraction (Zod-validated)
 * → record the call → deterministic apply. Does NOT manage the message's
 * queue/processing status — the caller (single route or queue worker) owns that,
 * except that applyExtraction sets the terminal status on success. Throws on
 * transient failures (retriable) and NonRetriableError on bad input.
 */
export async function processMessageById(
  messageId: string,
  override?: unknown,
): Promise<ProcessOutcome> {
  const admin = createAdminClient();

  const { data: msg, error } = await admin
    .from("line_messages")
    .select("id, organization_id, line_group_id, sent_at, text_content, quoted_line_message_id")
    .eq("id", messageId)
    .single();
  if (error || !msg) throw new NonRetriableError("message not found");
  if (!msg.organization_id || !msg.line_group_id) {
    throw new NonRetriableError("message has no active organization/group");
  }

  const { data: org } = await admin
    .from("organizations")
    .select("locale, timezone")
    .eq("id", msg.organization_id)
    .single();

  const input = await buildContext(admin, msg, org?.locale ?? "th-TH", org?.timezone ?? "Asia/Bangkok");
  const inputHash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");

  let extraction;
  let provider = "override";
  let model = "override";
  let latencyMs = 0;
  try {
    if (override) {
      extraction = TripExtractionSchema.parse(override);
    } else {
      const result = await new OpenRouterExtractor().extract(input);
      extraction = result.extraction;
      provider = result.provider;
      model = result.model;
      latencyMs = result.latencyMs;
    }
  } catch (err) {
    await recordExtraction(admin, msg, { provider, model, inputHash, extraction: null, status: "failed", latencyMs, error: err });
    throw err; // transient (AI/network/parse) — caller decides retry vs dead-letter
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

  return { provider, model, ...result };
}

async function buildContext(
  admin: Admin,
  msg: {
    id: string;
    line_group_id: string | null;
    sent_at: string;
    text_content: string | null;
    quoted_line_message_id: string | null;
    organization_id: string | null;
  },
  locale: string,
  timezone: string,
): Promise<ExtractionInput> {
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

  const { data: attachments } = await admin
    .from("message_attachments")
    .select("extracted_text")
    .eq("line_message_id", msg.id)
    .not("extracted_text", "is", null);
  const attachmentText = (attachments ?? []).map((a) => a.extracted_text!).join("\n\n") || undefined;

  let quotedText: string | undefined;
  if (msg.quoted_line_message_id) {
    const { data: quoted } = await admin
      .from("line_messages")
      .select("text_content")
      .eq("line_message_id", msg.quoted_line_message_id)
      .maybeSingle();
    quotedText = quoted?.text_content ?? undefined;
  }

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
