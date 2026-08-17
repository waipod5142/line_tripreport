import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LineMessage } from "@/lib/types";
import {
  PAGE_SIZE,
  pgrstQuote,
  type MessageFilters,
} from "@/lib/messages/filters";

// Live read of captured LINE messages. Uses the RLS server client, so results
// are automatically scoped to the signed-in user's organization.
//
// Filtering happens in Postgres, not in the browser — the list renders one page
// at a time and the CSV export streams every matching row, and both go through
// the same query builder so they can never disagree.

type Row = {
  id: string;
  line_message_id: string | null;
  message_type: string;
  text_content: string | null;
  sent_at: string;
  processing_status: string;
  line_groups: { group_name: string | null } | null;
  line_members: { display_name: string | null } | null;
  message_attachments: {
    id: string;
    original_filename: string | null;
    mime_type: string | null;
    retrieval_status: string;
  }[];
};

const SELECT = `id, line_message_id, message_type, text_content, sent_at, processing_status,
   line_groups ( group_name ),
   line_members ( display_name ),
   message_attachments ( id, original_filename, mime_type, retrieval_status )`;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Free text has to match across three tables (message body, group name, sender
 * name, attachment filename), and both the group and member links are nullable
 * — an `!inner` join would silently drop messages that have no sender on file.
 * So the joined tables are resolved to id lists first and folded into a single
 * top-level `or` on line_messages, which keeps LEFT JOIN semantics.
 */
const ATTACHMENT_MATCH_CAP = 5000;

async function resolveSearchClause(
  supabase: Supabase,
  q: string,
): Promise<string | null> {
  if (!q) return null;
  const pattern = pgrstQuote(`%${q}%`);
  const clauses = [`text_content.ilike.${pattern}`];

  const [groups, members, attachments] = await Promise.all([
    supabase.from("line_groups").select("id").ilike("group_name", `%${q}%`),
    supabase.from("line_members").select("id").ilike("display_name", `%${q}%`),
    supabase
      .from("message_attachments")
      .select("line_message_id")
      .ilike("original_filename", `%${q}%`)
      .limit(ATTACHMENT_MATCH_CAP),
  ]);

  const groupIds = ((groups.data ?? []) as unknown as { id: string }[]).map((r) => r.id);
  if (groupIds.length) clauses.push(`line_group_id.in.(${groupIds.join(",")})`);

  const memberIds = ((members.data ?? []) as unknown as { id: string }[]).map((r) => r.id);
  if (memberIds.length) clauses.push(`line_member_id.in.(${memberIds.join(",")})`);

  const messageIds = [
    ...new Set(
      ((attachments.data ?? []) as unknown as { line_message_id: string | null }[])
        .map((r) => r.line_message_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (messageIds.length) clauses.push(`id.in.(${messageIds.join(",")})`);

  return clauses.join(",");
}

/**
 * Base query for a filter set. `sent_at` alone is not a unique sort key, so `id`
 * breaks ties — without it, rows can repeat or vanish between pages of the
 * export as Postgres is free to reorder equal keys.
 */
function baseQuery(
  supabase: Supabase,
  filters: MessageFilters,
  searchClause: string | null,
  count: boolean,
) {
  let query = supabase
    .from("line_messages")
    .select(SELECT, count ? { count: "exact" } : undefined);

  if (filters.group !== "all") query = query.eq("line_group_id", filters.group);
  if (filters.type !== "all") query = query.eq("message_type", filters.type);
  if (filters.status !== "all") query = query.eq("processing_status", filters.status);
  if (searchClause) query = query.or(searchClause);

  return query
    .order("sent_at", { ascending: false })
    .order("id", { ascending: false });
}

export interface MessagePage {
  rows: LineMessage[];
  /** Total matching rows across all pages. */
  total: number;
  page: number;
  pageCount: number;
}

/** One page of messages matching `filters`, newest first. */
export async function listMessagesPage(
  filters: MessageFilters,
  page = 1,
  pageSize = PAGE_SIZE,
): Promise<MessagePage> {
  const supabase = await createClient();
  const searchClause = await resolveSearchClause(supabase, filters.q);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await baseQuery(
    supabase,
    filters,
    searchClause,
    true,
  ).range(from, from + pageSize - 1);

  if (error) throw error;

  const total = count ?? 0;
  return {
    rows: ((data ?? []) as unknown as Row[]).map(mapRow),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Total rows matching `filters`, without fetching them. */
export async function countMessages(filters: MessageFilters): Promise<number> {
  const supabase = await createClient();
  const searchClause = await resolveSearchClause(supabase, filters.q);

  let query = supabase
    .from("line_messages")
    .select("id", { count: "exact", head: true });
  if (filters.group !== "all") query = query.eq("line_group_id", filters.group);
  if (filters.type !== "all") query = query.eq("message_type", filters.type);
  if (filters.status !== "all") query = query.eq("processing_status", filters.status);
  if (searchClause) query = query.or(searchClause);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Every message matching `filters`, yielded in batches so the export never
 * holds the whole result set in memory.
 */
export async function* iterateMessages(
  filters: MessageFilters,
  batchSize = 500,
): AsyncGenerator<LineMessage[]> {
  const supabase = await createClient();
  const searchClause = await resolveSearchClause(supabase, filters.q);

  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await baseQuery(
      supabase,
      filters,
      searchClause,
      false,
    ).range(offset, offset + batchSize - 1);

    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    if (rows.length === 0) return;

    yield rows.map(mapRow);
    if (rows.length < batchSize) return;
  }
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
    attachmentName:
      attachments[0]?.filename ??
      r.message_attachments?.[0]?.original_filename ??
      null,
    attachments,
  };
}
