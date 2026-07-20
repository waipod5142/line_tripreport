import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTACHMENTS_BUCKET } from "@/lib/supabase/storage";
import { LineClient } from "@/lib/line/client";

type Admin = ReturnType<typeof createAdminClient>;

const MAX_BYTES = 25 * 1024 * 1024; // matches the bucket's file_size_limit

// Executable/script types are never stored (FR-ATT-005). Everything else is
// kept as evidence; unknown types are flagged in scan_status, not rejected.
const BLOCKED_MIME = new Set([
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-sh",
  "application/x-shellscript",
]);
const KNOWN_SAFE_PREFIXES = ["image/", "video/", "audio/", "text/"];
const KNOWN_SAFE_EXACT = new Set([
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export interface RetrieveSummary {
  claimed: number;
  stored: number;
  failed: number;
  skipped: number;
}

/**
 * Retrieve up to `limit` pending attachments. Each is claimed atomically
 * (pending → retrieving) so concurrent invocations don't double-fetch. LINE
 * content is ephemeral, so this should run promptly after ingestion.
 */
export async function retrievePendingAttachments(
  limit = 10,
): Promise<RetrieveSummary> {
  const admin = createAdminClient();
  const line = new LineClient();
  const summary: RetrieveSummary = { claimed: 0, stored: 0, failed: 0, skipped: 0 };

  const { data: pending } = await admin
    .from("message_attachments")
    .select("id, storage_path, line_message_id, original_filename")
    .eq("retrieval_status", "pending")
    .limit(limit);

  for (const att of pending ?? []) {
    // Atomic claim — only one worker wins the pending → retrieving transition.
    const { data: claimed } = await admin
      .from("message_attachments")
      .update({ retrieval_status: "retrieving" })
      .eq("id", att.id)
      .eq("retrieval_status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) {
      summary.skipped += 1;
      continue;
    }
    summary.claimed += 1;

    try {
      await retrieveOne(admin, line, att);
      summary.stored += 1;
    } catch (err) {
      summary.failed += 1;
      await admin
        .from("message_attachments")
        .update({
          retrieval_status: "failed",
          scan_status: err instanceof Error ? err.message.slice(0, 200) : "error",
        })
        .eq("id", att.id);
    }
  }

  return summary;
}

async function retrieveOne(
  admin: Admin,
  line: LineClient,
  att: { id: string; storage_path: string; line_message_id: string; original_filename: string | null },
): Promise<void> {
  // message_attachments.line_message_id is our FK → resolve the LINE message id.
  const { data: msg } = await admin
    .from("line_messages")
    .select("line_message_id")
    .eq("id", att.line_message_id)
    .single();
  const lineMessageId = msg?.line_message_id;
  if (!lineMessageId) throw new Error("line message id not found");

  const content = await line.getContent(lineMessageId);
  const bytes = Buffer.from(content.data);

  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(`too large (${bytes.byteLength} bytes)`);
  }

  const mime = content.contentType ?? "application/octet-stream";
  if (BLOCKED_MIME.has(mime)) {
    await admin
      .from("message_attachments")
      .update({ retrieval_status: "failed", scan_status: "blocked_type", mime_type: mime })
      .eq("id", att.id);
    return;
  }

  const { error: uploadErr } = await admin.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(att.storage_path, bytes, { contentType: mime, upsert: true });
  if (uploadErr) throw new Error(`upload failed: ${uploadErr.message}`);

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  await admin
    .from("message_attachments")
    .update({
      retrieval_status: "stored",
      mime_type: mime,
      size_bytes: bytes.byteLength,
      sha256,
      scan_status: isKnownSafe(mime) ? "clean" : "unknown_type",
    })
    .eq("id", att.id);
}

function isKnownSafe(mime: string): boolean {
  return (
    KNOWN_SAFE_PREFIXES.some((p) => mime.startsWith(p)) || KNOWN_SAFE_EXACT.has(mime)
  );
}
