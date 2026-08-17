import { ShieldCheck } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { GroupManager } from "@/components/settings/group-manager";
import { countMessagesByGroup, listAllGroups } from "@/lib/data/groups";
import { getCurrentUser } from "@/lib/data/session";

// Group status is administered here, so never serve a cached list.
export const dynamic = "force-dynamic";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[220px_1fr] sm:items-center">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const inputCls =
  "h-9 w-full max-w-sm rounded border border-line bg-panel px-2.5 text-sm text-ink-soft focus:border-line-strong focus:bg-canvas focus:outline-none";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const canManage = user?.profile?.role === "system_administrator";

  // The group list includes pending groups, which belong to no organization —
  // only an administrator has any business seeing or adopting those.
  const groups = canManage ? await listAllGroups() : [];
  const counts = canManage
    ? await countMessagesByGroup(groups.map((g) => g.id))
    : {};

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Organization configuration and the LINE groups this workspace captures."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="LINE groups"
            action={
              <span className="text-xs text-muted">
                Only active groups are captured
              </span>
            }
          />
          {canManage ? (
            <>
              <div className="border-b border-line px-4 py-3 text-xs text-muted">
                To add a group, invite the LINE official account to the chat. It
                registers itself here as <span className="font-medium">pending</span>{" "}
                within seconds — approve it and its messages start landing in the
                inbox. Messages sent while a group is pending are discarded, so
                approve it before you need the history.
              </div>
              <GroupManager groups={groups} counts={counts} canManage={canManage} />
            </>
          ) : (
            <CardBody>
              <p className="text-sm text-muted">
                Only an administrator can view and manage captured groups.
              </p>
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title="Organization" />
          <CardBody className="divide-y divide-line">
            <Row label="Name">
              <input
                className={inputCls}
                defaultValue="GEOID (Thailand) Co., Ltd."
                readOnly
              />
            </Row>
            <Row label="Locale" hint="Ambiguous dates read as DD/MM/YYYY">
              <input className={inputCls} defaultValue="th-TH" readOnly />
            </Row>
            <Row label="Timezone" hint="Timestamps stored UTC, shown local">
              <input className={inputCls} defaultValue="Asia/Bangkok" readOnly />
            </Row>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Retention" />
          <CardBody className="divide-y divide-line">
            <Row label="Raw messages" hint="Original webhook payloads">
              <input className={inputCls} defaultValue="365 days" readOnly />
            </Row>
            <Row label="Attachments" hint="Private storage bucket">
              <input className={inputCls} defaultValue="180 days" readOnly />
            </Row>
          </CardBody>
        </Card>

        <div className="flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-3 text-xs text-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--st-green)]" />
          Secrets live in server-only environment variables and Supabase RLS scopes
          every query to this organization. Nothing sensitive reaches the browser.
        </div>
      </div>
    </>
  );
}
