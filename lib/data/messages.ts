import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LineMessage } from "@/lib/types";

// Live read of captured LINE messages for the operations UI.
//
// TEMPORARY: uses the service-role client because auth/login isn't wired yet, so
// there's no session for RLS to scope. The key stays server-side. Once Supabase
// Auth is added, swap this for the RLS server client (lib/supabase/server) and
// drop the explicit org handling — RLS will scope automatically.

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
  message_attachments: { original_filename: string | null }[];
  message_trip_links: { trip_id: string }[];
};

export async function listMessages(limit = 100): Promise<LineMessage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("line_messages")
    .select(
      `id, line_message_id, message_type, text_content, sent_at, processing_status, classification,
       line_groups ( group_name ),
       line_members ( display_name ),
       message_attachments ( original_filename ),
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
    attachmentName: r.message_attachments?.[0]?.original_filename ?? null,
  };
}
