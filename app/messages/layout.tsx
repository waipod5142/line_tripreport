import { Shell } from "@/components/shell/shell";
import { getCurrentUser } from "@/lib/data/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Auth-free layout for /messages. Unlike the dashboard group, this never
// redirects to /login — the page is intentionally public (see middleware
// PUBLIC_PREFIXES). We still surface the signed-in user in the shell when a
// session happens to exist, but fall back to a guest identity otherwise.
export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser(); // may be null — no redirect either way.

  // Public page: count open review items via the service-role client so the
  // sidebar badge renders without a session (bypasses RLS by design).
  const admin = createAdminClient();
  const { count } = await admin
    .from("review_items")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_review"]);

  return (
    <Shell
      reviewCount={count ?? 0}
      user={{
        name: user?.profile?.displayName ?? user?.email ?? "Guest",
        email: user?.email ?? "",
        role: user?.profile?.role ?? "viewer",
      }}
    >
      {children}
    </Shell>
  );
}
