"use server";

import { getCurrentUser } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

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
