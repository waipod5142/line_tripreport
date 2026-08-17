import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// LINE groups the bot has been added to. A group only reaches the inbox once an
// administrator activates it (see `lib/line/ingest.ts` — messages from a
// non-active group are quarantined as raw webhook events and never stored).

export type GroupStatus = "pending" | "active" | "paused" | "blocked";

/** A group as offered in the inbox filter — active ones only. */
export interface GroupOption {
  id: string;
  name: string;
}

/** A group as administered on the settings screen. */
export interface GroupRecord extends GroupOption {
  lineGroupId: string;
  status: GroupStatus;
  joinedAt: string | null;
  lastMessageAt: string | null;
}

type Row = {
  id: string;
  line_group_id: string;
  group_name: string | null;
  status: string;
  joined_at: string | null;
  last_message_at: string | null;
};

/** Falls back to the LINE id so a group whose name lookup failed is still pickable. */
function displayName(r: Row): string {
  return r.group_name?.trim() || r.line_group_id;
}

/**
 * Groups offered in the inbox filter and the export. Adopted groups, whatever
 * their status — a paused group stops capturing but keeps its history, which
 * still needs to be filterable and exportable. Pending groups are excluded:
 * they belong to no org and by definition have no messages.
 *
 * Read through the RLS client, so activating a new group in Settings makes it
 * selectable here immediately, with no code change.
 */
export async function listInboxGroups(): Promise<GroupOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("line_groups")
    .select("id, line_group_id, group_name, status, joined_at, last_message_at")
    .not("organization_id", "is", null)
    .order("group_name", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    name: displayName(r),
  }));
}

/**
 * Every group the bot has ever joined, including `pending` ones that belong to
 * no organization yet.
 *
 * Uses the admin client rather than RLS: a pending group has a null
 * organization_id, and while the select policy lets an administrator read those,
 * nothing scopes them to a tenant. Callers must therefore check the caller is a
 * system administrator of the single org before invoking this.
 */
export async function listAllGroups(): Promise<GroupRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("line_groups")
    .select("id, line_group_id, group_name, status, joined_at, last_message_at")
    .order("status", { ascending: true })
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    name: displayName(r),
    lineGroupId: r.line_group_id,
    status: r.status as GroupStatus,
    joinedAt: r.joined_at,
    lastMessageAt: r.last_message_at,
  }));
}

/**
 * Messages captured per group id, so the settings list shows real volume — the
 * quickest way to tell an activated group is actually working. One head count
 * per group; the group list is small and administered by hand.
 */
export async function countMessagesByGroup(
  groupIds: string[],
): Promise<Record<string, number>> {
  const admin = createAdminClient();
  const counts = await Promise.all(
    groupIds.map(async (id) => {
      const { count } = await admin
        .from("line_messages")
        .select("id", { count: "exact", head: true })
        .eq("line_group_id", id);
      return [id, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts);
}
