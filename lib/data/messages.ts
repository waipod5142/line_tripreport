import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LineMessage } from "@/lib/types";

// Live read of captured LINE messages. Uses the RLS server client, so results
// are automatically scoped to the signed-in user's organization.

type Row = {
  id: string;
  line_message_id: string | null;
  message_type: string;
  text_content: string | null;
  sent_at: string;
  processing_status: string;
  classification: string | null;
  line_groups: { group_name: string | null } | null;
  line_members: { display_name: string | null } | null;
  message_attachments: {
    id: string;
    original_filename: string | null;
    mime_type: string | null;
    retrieval_status: string;
  }[];
  message_trip_links: { trip_id: string }[];
};

export async function listMessages(limit = 100): Promise<LineMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("line_messages")
    .select(
      `id, line_message_id, message_type, text_content, sent_at, processing_status, classification,
       line_groups ( group_name ),
       line_members ( display_name ),
       message_attachments ( id, original_filename, mime_type, retrieval_status ),
       message_trip_links ( trip_id )`,
    )
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

const KNOWN_TYPES = new Set(["text", "image", "file", "location", "sticker"]);

function mapRow(r: Row): LineMessage {
  const type = KNOWN_TYPES.has(r.message_type)
    ? (r.message_type as LineMessage["messageType"])
    : "file"; // video/audio/etc. fall back to the file icon

  // Only stored attachments are viewable (a signed URL can be minted for them).
  const attachments = (r.message_attachments ?? [])
    .filter((a) => a.retrieval_status === "stored")
    .map((a) => ({
      id: a.id,
      filename: a.original_filename ?? a.id,
      mimeType: a.mime_type,
      kind: (a.mime_type ?? "").startsWith("image/") ? ("image" as const) : ("file" as const),
    }));

  return {
    id: r.id,
    lineMessageId: r.line_message_id ?? r.id,
    group: r.line_groups?.group_name ?? "Unknown group",
    senderName: r.line_members?.display_name ?? "Unknown sender",
    messageType: type,
    text: r.text_content,
    sentAt: r.sent_at,
    processingStatus: r.processing_status as LineMessage["processingStatus"],
    classification: (r.classification as LineMessage["classification"]) ?? null,
    linkedTripId: r.message_trip_links?.[0]?.trip_id ?? null,
    attachmentName:
      attachments[0]?.filename ??
      r.message_attachments?.[0]?.original_filename ??
      null,
    attachments,
  };
}
