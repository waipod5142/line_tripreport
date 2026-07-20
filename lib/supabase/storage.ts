import "server-only";
import { createAdminClient } from "./admin";

export const ATTACHMENTS_BUCKET = "attachments";

/**
 * Short-lived signed URL for an attachment (FR-ATT-007). The bucket is private,
 * so this is the only way authorized UI can display a file. Default 60s.
 */
export async function createSignedAttachmentUrl(
  storagePath: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}
