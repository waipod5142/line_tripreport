import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { LineClient } from "@/lib/line/client";
import {
  MEDIA_MESSAGE_TYPES,
  type LineEvent,
  type LineWebhookBody,
} from "@/lib/line/webhook-schema";

type Admin = ReturnType<typeof createAdminClient>;

export type EventOutcome =
  | "stored" // message captured for an active group
  | "duplicate" // webhookEventId already seen — idempotent no-op
  | "quarantined" // group unknown / not active — raw kept, no message
  | "group_registered" // join event registered a pending group
  | "ignored"; // non-group / unsupported event, raw kept only

export interface IngestSummary {
  total: number;
  outcomes: Record<EventOutcome, number>;
}

// Text messages are queued for AI extraction; media is captured ('stored') for
// the attachment worker; anything else is just recorded ('processed').
function initialStatus(messageType: string): string {
  if (messageType === "text") return "queued";
  if ((MEDIA_MESSAGE_TYPES as readonly string[]).includes(messageType)) return "stored";
  return "processed";
}

/** Entry point: process a verified, parsed webhook body. */
export async function ingestWebhookBody(
  body: LineWebhookBody,
  destination: string | undefined,
): Promise<IngestSummary> {
  const admin = createAdminClient();
  const line = new LineClient();
  const outcomes: Record<EventOutcome, number> = {
    stored: 0,
    duplicate: 0,
    quarantined: 0,
    group_registered: 0,
    ignored: 0,
  };

  for (const event of body.events) {
    const outcome = await storeEvent(admin, line, event, destination);
    outcomes[outcome] += 1;
  }

  return { total: body.events.length, outcomes };
}

function webhookEventIdFor(event: LineEvent): string {
  if (event.webhookEventId) return event.webhookEventId;
  // Deterministic fallback so replays of an ID-less event still dedupe.
  const basis = JSON.stringify({
    t: event.type,
    ts: event.timestamp,
    s: event.source,
    m: event.message?.id,
  });
  return "gen_" + crypto.createHash("sha256").update(basis).digest("hex").slice(0, 40);
}

async function storeEvent(
  admin: Admin,
  line: LineClient,
  event: LineEvent,
  destination: string | undefined,
): Promise<EventOutcome> {
  const webhookEventId = webhookEventIdFor(event);

  // 1) Idempotent insert of the raw event (FR-LINE-004/005). A unique-violation
  //    means we've already handled this delivery — safe replay.
  const { data: inserted, error: insertErr } = await admin
    .from("webhook_events")
    .insert({
      webhook_event_id: webhookEventId,
      destination: destination ?? null,
      event_type: event.type,
      event_timestamp: new Date(event.timestamp).toISOString(),
      is_redelivery: event.deliveryContext?.isRedelivery ?? false,
      signature_verified: true,
      raw_payload: event as unknown as Json,
      processing_status: "received",
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") return "duplicate";
    throw insertErr;
  }
  const webhookRowId = inserted.id;

  try {
    const outcome = await handleEvent(admin, line, event, webhookRowId);
    await admin
      .from("webhook_events")
      .update({ processing_status: "stored" })
      .eq("id", webhookRowId);
    return outcome;
  } catch (err) {
    await admin
      .from("webhook_events")
      .update({
        processing_status: "failed",
        last_error: err instanceof Error ? err.message : String(err),
      })
      .eq("id", webhookRowId);
    throw err;
  }
}

async function handleEvent(
  admin: Admin,
  line: LineClient,
  event: LineEvent,
  webhookRowId: string,
): Promise<EventOutcome> {
  const groupId = event.source?.groupId;

  // Bot joined a group → register it as pending for an admin to activate (9.1).
  if (event.type === "join" && groupId) {
    await ensureGroup(admin, line, groupId);
    return "group_registered";
  }

  if (event.type === "unsend" && event.unsend) {
    await applyUnsend(admin, event.unsend.messageId);
    return "stored";
  }

  // MVP only captures messages from groups.
  if (event.type !== "message" || !groupId || !event.message) {
    return "ignored";
  }

  const group = await ensureGroup(admin, line, groupId);
  if (group.status !== "active" || !group.organization_id) {
    return "quarantined"; // raw event kept; nothing processed
  }
  const orgId = group.organization_id;

  const memberId = event.source?.userId
    ? await upsertMember(admin, line, orgId, groupId, event.source.userId)
    : null;

  const msg = event.message;
  const { data: msgRow, error: msgErr } = await admin
    .from("line_messages")
    .insert({
      organization_id: orgId,
      webhook_event_id: webhookRowId,
      line_message_id: msg.id,
      line_group_id: group.id,
      line_member_id: memberId,
      message_type: msg.type,
      text_content: msg.text ?? null,
      quoted_line_message_id: msg.quotedMessageId ?? null,
      sent_at: new Date(event.timestamp).toISOString(),
      processing_status: initialStatus(msg.type),
      raw_message: event as unknown as Json,
    })
    .select("id")
    .single();

  if (msgErr) {
    if (msgErr.code === "23505") return "duplicate"; // message already stored
    throw msgErr;
  }

  await admin
    .from("line_groups")
    .update({ last_message_at: new Date(event.timestamp).toISOString() })
    .eq("id", group.id);

  // Register a placeholder for media so the worker can fetch + store content.
  if ((MEDIA_MESSAGE_TYPES as readonly string[]).includes(msg.type)) {
    await admin.from("message_attachments").insert({
      organization_id: orgId,
      line_message_id: msgRow.id,
      original_filename: msg.fileName ?? null,
      size_bytes: msg.fileSize ?? null,
      storage_bucket: "attachments",
      storage_path: `${orgId}/${msgRow.id}/${msg.fileName ?? msg.id}`,
      retrieval_status: "pending",
    });
  }

  return "stored";
}

interface GroupRow {
  id: string;
  organization_id: string | null;
  status: string;
}

async function ensureGroup(
  admin: Admin,
  line: LineClient,
  lineGroupId: string,
): Promise<GroupRow> {
  const existing = await admin
    .from("line_groups")
    .select("id, organization_id, status")
    .eq("line_group_id", lineGroupId)
    .maybeSingle();

  if (existing.data) return existing.data;

  // Best-effort name enrichment; failure must not block registration.
  let groupName: string | null = null;
  try {
    const summary = await line.getGroupSummary(lineGroupId);
    groupName = summary?.groupName ?? null;
  } catch {
    /* ignore */
  }

  const inserted = await admin
    .from("line_groups")
    .insert({
      line_group_id: lineGroupId,
      group_name: groupName,
      status: "pending",
      joined_at: new Date().toISOString(),
    })
    .select("id, organization_id, status")
    .single();

  if (inserted.error) {
    // Concurrent insert — re-read the winner.
    const reread = await admin
      .from("line_groups")
      .select("id, organization_id, status")
      .eq("line_group_id", lineGroupId)
      .single();
    if (reread.error) throw reread.error;
    return reread.data;
  }
  return inserted.data;
}

async function upsertMember(
  admin: Admin,
  line: LineClient,
  orgId: string,
  groupId: string,
  userId: string,
): Promise<string | null> {
  let displayName: string | null = null;
  let pictureUrl: string | null = null;
  try {
    const profile = await line.getGroupMemberProfile(groupId, userId);
    displayName = profile?.displayName ?? null;
    pictureUrl = profile?.pictureUrl ?? null;
  } catch {
    /* ignore — enrichment is best-effort */
  }

  const { data, error } = await admin
    .from("line_members")
    .upsert(
      {
        organization_id: orgId,
        line_user_id: userId,
        display_name: displayName,
        picture_url: pictureUrl,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,line_user_id" },
    )
    .select("id")
    .single();

  if (error) return null;
  return data.id;
}

async function applyUnsend(admin: Admin, lineMessageId: string): Promise<void> {
  // FR-LINE-012: mark unavailable and redact the text.
  await admin
    .from("line_messages")
    .update({ is_unsent: true, text_content: null })
    .eq("line_message_id", lineMessageId);
}
