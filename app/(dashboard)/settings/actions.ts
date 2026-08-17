"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GroupStatus } from "@/lib/data/groups";

export interface GroupActionResult {
  ok: boolean;
  error?: string;
}

const ALLOWED: GroupStatus[] = ["active", "paused"];

/**
 * Adopt a LINE group into the organization, or pause one.
 *
 * Adding a group is a two-step dance by design: the bot registers itself as
 * `pending` the moment it is added to a chat (`lib/line/ingest.ts`), and an
 * administrator decides whether that chat is ours. Until then its messages are
 * quarantined as raw webhook events and never stored.
 *
 * Uses the service-role client rather than RLS: a pending group has a null
 * organization_id, and the line_groups write policy requires the row to already
 * match the caller's org — so the very first claim can't be made through RLS.
 * The role check below is therefore the whole authorization boundary.
 */
export async function setGroupStatusAction(
  groupId: string,
  status: GroupStatus,
): Promise<GroupActionResult> {
  const user = await getCurrentUser();
  if (!user?.profile) return { ok: false, error: "Not authorized." };
  if (user.profile.role !== "system_administrator") {
    return { ok: false, error: "Only an administrator can change group capture." };
  }
  if (!ALLOWED.includes(status)) return { ok: false, error: "Unsupported status." };

  const admin = createAdminClient();

  // Refuse to move a group that already belongs to a different organization —
  // the service-role client would happily let us steal it.
  const { data } = await admin
    .from("line_groups")
    .select("organization_id")
    .eq("id", groupId)
    .maybeSingle();
  const existing = data as unknown as { organization_id: string | null } | null;
  if (!existing) return { ok: false, error: "Group not found." };
  if (
    existing.organization_id &&
    existing.organization_id !== user.profile.organizationId
  ) {
    return { ok: false, error: "That group belongs to another organization." };
  }

  const { error } = await admin
    .from("line_groups")
    .update({
      status,
      organization_id: user.profile.organizationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/messages");
  return { ok: true };
}
