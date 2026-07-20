import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { NonRetriableError, processMessageById } from "./process";

const MAX_ATTEMPTS = 3;

export interface QueueSummary {
  claimed: number;
  processed: number;
  retried: number;
  deadLettered: number;
}

/**
 * Drain up to `limit` queued messages. Each is claimed atomically
 * (queued → processing) so overlapping runs (webhook after() + pg_cron) don't
 * double-process. On failure a message is requeued until MAX_ATTEMPTS, then
 * dead-lettered to 'failed' with last_error (PRD §14.2).
 */
export async function processQueue(limit = 3): Promise<QueueSummary> {
  const admin = createAdminClient();
  const summary: QueueSummary = { claimed: 0, processed: 0, retried: 0, deadLettered: 0 };

  const { data: pending } = await admin
    .from("line_messages")
    .select("id, processing_attempts")
    .eq("processing_status", "queued")
    .lt("processing_attempts", MAX_ATTEMPTS)
    .order("sent_at", { ascending: true })
    .limit(limit);

  for (const m of pending ?? []) {
    const { data: claimed } = await admin
      .from("line_messages")
      .update({ processing_status: "processing" })
      .eq("id", m.id)
      .eq("processing_status", "queued")
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // another worker took it
    summary.claimed += 1;

    try {
      await processMessageById(m.id); // applyExtraction sets the terminal status
      summary.processed += 1;
    } catch (err) {
      const attempts = (m.processing_attempts ?? 0) + 1;
      const dead = err instanceof NonRetriableError || attempts >= MAX_ATTEMPTS;
      await admin
        .from("line_messages")
        .update({
          processing_status: dead ? "failed" : "queued",
          processing_attempts: attempts,
          last_error: err instanceof Error ? err.message.slice(0, 300) : String(err),
        })
        .eq("id", m.id);
      if (dead) summary.deadLettered += 1;
      else summary.retried += 1;
    }
  }

  return summary;
}
