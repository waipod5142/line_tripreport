"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NonRetriableError, processMessageById } from "@/lib/ai/process";

const WRITER_ROLES = ["system_administrator", "operations_manager", "dispatcher"];

export interface ProcessActionResult {
  ok: boolean;
  error?: string;
  action?: string;
  tripId?: string | null;
}

/**
 * Manually run the AI worker on one message (create/update its trip + summary).
 * Authorized to writer roles. Runs synchronously — the caller sees a pending
 * state while kimi-k3 works (~50s).
 */
export async function processMessageAction(
  messageId: string,
): Promise<ProcessActionResult> {
  const user = await getCurrentUser();
  if (!user?.profile) return { ok: false, error: "Not authorized." };
  if (!WRITER_ROLES.includes(user.profile.role)) {
    return { ok: false, error: "You don’t have permission to run the AI worker." };
  }

  const admin = createAdminClient();
  await admin
    .from("line_messages")
    .update({ processing_status: "processing" })
    .eq("id", messageId);

  try {
    const result = await processMessageById(messageId);
    revalidatePath("/messages");
    revalidatePath("/trips");
    revalidatePath("/dashboard");
    return { ok: true, action: result.action, tripId: result.tripId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const nonRetriable = err instanceof NonRetriableError;
    await admin
      .from("line_messages")
      .update({
        processing_status: nonRetriable ? "stored" : "failed",
        last_error: detail,
      })
      .eq("id", messageId);
    revalidatePath("/messages");
    return { ok: false, error: detail };
  }
}

export interface AttachmentUrlResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Mint a short-lived signed URL for viewing a stored attachment. Any org member
 * may view — the RLS client scopes both the lookup and the storage signing to
 * the caller's organization, so no service-role key is involved.
 */
export async function getAttachmentUrlAction(
  attachmentId: string,
): Promise<AttachmentUrlResult> {
  const user = await getCurrentUser();
  if (!user?.profile) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("message_attachments")
    .select("storage_bucket, storage_path, retrieval_status")
    .eq("id", attachmentId)
    .maybeSingle();
  const att = data as unknown as {
    storage_bucket: string;
    storage_path: string;
    retrieval_status: string;
  } | null;
  if (!att) return { ok: false, error: "Attachment not found." };
  if (att.retrieval_status !== "stored") {
    return { ok: false, error: "Attachment is not available yet." };
  }

  const { data: signed, error } = await supabase.storage
    .from(att.storage_bucket)
    .createSignedUrl(att.storage_path, 300); // 5-minute link
  if (error || !signed) {
    return { ok: false, error: error?.message ?? "Could not create a link." };
  }
  return { ok: true, url: signed.signedUrl };
}
