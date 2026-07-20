import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: {
    organizationId: string;
    role: string;
    displayName: string | null;
  } | null;
}

/**
 * The signed-in user plus their profile. profile is null when the user is
 * authenticated but not allowlisted (no provisioned profile → RLS grants no
 * data). Reads go through the RLS server client.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("organization_id, role, display_name")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as
    | { organization_id: string; role: string; display_name: string | null }
    | null;

  return {
    id: user.id,
    email: user.email ?? null,
    profile: profile
      ? {
          organizationId: profile.organization_id,
          role: profile.role,
          displayName: profile.display_name,
        }
      : null,
  };
}
