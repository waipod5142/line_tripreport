import { Cpu, ShieldCheck } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Code, CodeChip } from "@/components/ui/code";
import { PageHeader } from "@/components/ui/page-header";

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

const GROUPS = [
  { name: "GEOID • Mukdahan Line", id: "Cxxxx…a91f", status: "active" },
  { name: "GEOID • Laem Chabang Line", id: "Cxxxx…7b20", status: "active" },
  { name: "GEOID • Nong Khai Line", id: "Cxxxx…4d0c", status: "paused" },
  { name: "Unknown group", id: "Cxxxx…ffee", status: "pending" },
];

const ALIASES = [
  { phrase: "ผ่านด่านลาว", event: "customs_lao_released" },
  { phrase: "ผ่านด่านไทย", event: "customs_thai_released" },
  { phrase: "รับตู้", event: "loaded_container_received" },
  { phrase: "ถึงโรงงาน", event: "arrived_destination" },
  { phrase: "ลงสินค้าเสร็จ", event: "unloading_completed" },
];

const USERS = [
  { name: "Wai", email: "waipody@gmail.com", role: "Operations manager" },
  { name: "โต้ง", email: "dispatch@geoid.co.th", role: "Dispatcher" },
  { name: "Ann", email: "viewer@geoid.co.th", role: "Viewer" },
];

const GROUP_HUE: Record<string, string> = {
  active: "var(--st-green)",
  paused: "var(--st-amber)",
  pending: "var(--st-neutral)",
  blocked: "var(--st-red)",
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Organization configuration, matching thresholds, integrations, and access."
      />

      <div className="space-y-6">
        {/* Organization */}
        <Card>
          <CardHeader title="Organization" />
          <CardBody className="divide-y divide-line">
            <Row label="Name">
              <input className={inputCls} defaultValue="GEOID (Thailand) Co., Ltd." readOnly />
            </Row>
            <Row label="Locale" hint="Ambiguous dates read as DD/MM/YYYY">
              <input className={inputCls} defaultValue="th-TH" readOnly />
            </Row>
            <Row label="Timezone" hint="Timestamps stored UTC, shown local">
              <input className={inputCls} defaultValue="Asia/Bangkok" readOnly />
            </Row>
          </CardBody>
        </Card>

        {/* Approved groups */}
        <Card>
          <CardHeader
            title="Approved LINE groups"
            action={<span className="text-xs text-muted">Only active groups are captured</span>}
          />
          <div className="divide-y divide-line">
            {GROUPS.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">
                    {g.name}
                  </div>
                  <Code muted className="text-2xs">
                    {g.id}
                  </Code>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize"
                  style={{
                    color: GROUP_HUE[g.status],
                    backgroundColor: `${GROUP_HUE[g.status]}14`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: GROUP_HUE[g.status] }}
                  />
                  {g.status}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Matching thresholds */}
        <Card>
          <CardHeader title="Matching & confidence thresholds" />
          <CardBody className="divide-y divide-line">
            <Row
              label="Auto-apply threshold"
              hint="Safe fields/events applied automatically at or above this confidence"
            >
              <CodeChip>0.90</CodeChip>
            </Row>
            <Row
              label="Review threshold"
              hint="Anything below this always goes to the review queue"
            >
              <CodeChip>0.70</CodeChip>
            </Row>
            <Row
              label="Cross-group shipment matching"
              hint="Match a shipment code across different LINE groups"
            >
              <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                <span className="h-4 w-8 rounded-full bg-line-strong p-0.5">
                  <span className="block h-3 w-3 rounded-full bg-canvas" />
                </span>
                Disabled
              </span>
            </Row>
          </CardBody>
        </Card>

        {/* AI provider */}
        <Card>
          <CardHeader
            title="AI extraction"
            action={
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--st-green)]">
                <Cpu className="h-3.5 w-3.5" /> Worker healthy
              </span>
            }
          />
          <CardBody className="divide-y divide-line">
            <Row label="Provider" hint="Swap without changing trip logic">
              <CodeChip>OpenRouter</CodeChip>
            </Row>
            <Row label="Model" hint="Configured via AI_MODEL env var">
              <CodeChip>moonshotai/kimi-k3</CodeChip>
            </Row>
            <Row label="API key" hint="Server-only, never sent to the browser">
              <Code muted>OPENROUTER_API_KEY ····························</Code>
            </Row>
            <Row label="Prompt / schema version">
              <span className="flex items-center gap-2">
                <CodeChip>prompt v1.0</CodeChip>
                <CodeChip>schema v1.0</CodeChip>
              </span>
            </Row>
          </CardBody>
        </Card>

        {/* Retention */}
        <Card>
          <CardHeader title="Retention" />
          <CardBody className="divide-y divide-line">
            <Row label="Raw messages" hint="Original webhook payloads">
              <input className={inputCls} defaultValue="365 days" readOnly />
            </Row>
            <Row label="Attachments" hint="Private storage bucket">
              <input className={inputCls} defaultValue="180 days" readOnly />
            </Row>
            <Row label="AI inputs / outputs" hint="For regression + audit">
              <input className={inputCls} defaultValue="90 days" readOnly />
            </Row>
          </CardBody>
        </Card>

        {/* Event aliases */}
        <Card>
          <CardHeader
            title="Event aliases"
            action={<span className="text-xs text-muted">Thai phrase → event type</span>}
          />
          <div className="divide-y divide-line">
            {ALIASES.map((a) => (
              <div
                key={a.phrase}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="font-thai text-sm text-ink">{a.phrase}</span>
                <Code muted className="text-xs">
                  {a.event}
                </Code>
              </div>
            ))}
          </div>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader title="Users & roles" />
          <div className="divide-y divide-line">
            {USERS.map((u) => (
              <div
                key={u.email}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 text-xs font-semibold text-ink-soft">
                  {u.name.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">
                    {u.name}
                  </div>
                  <div className="truncate text-xs text-muted">{u.email}</div>
                </div>
                <span className="text-xs text-ink-soft">{u.role}</span>
              </div>
            ))}
          </div>
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
