import { redirect } from "next/navigation";
import { ShieldAlert, Waypoints } from "lucide-react";
import { Shell } from "@/components/shell/shell";
import { getCurrentUser } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Authenticated but not allowlisted → no profile → no data access.
  if (!user.profile) {
    return <AccessPending email={user.email} />;
  }

  // Count open review items for the sidebar badge (RLS-scoped to the org).
  const supabase = await createClient();
  const { count } = await supabase
    .from("review_items")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_review"]);

  return (
    <Shell
      reviewCount={count ?? 0}
      user={{
        name: user.profile.displayName ?? user.email ?? "User",
        email: user.email ?? "",
        role: user.profile.role,
      }}
    >
      {children}
    </Shell>
  );
}

function AccessPending({ email }: { email: string | null }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="w-full max-w-md rounded-md border border-line bg-panel p-8 text-center shadow-card">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-md bg-accent text-white">
          <Waypoints className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div className="mt-4 inline-flex items-center gap-1.5 text-[var(--st-amber)]">
          <ShieldAlert className="h-4 w-4" />
          <span className="text-sm font-medium">Access pending</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          You’re signed in as{" "}
          <span className="font-medium text-ink-soft">{email}</span>, but this
          account isn’t authorized for any organization yet. Ask an administrator to
          add your email to the allowlist.
        </p>
        <form action="/auth/signout" method="post" className="mt-5">
          <button className="text-xs font-medium text-accent hover:text-accent-ink">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
