"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Loader2, Pause, Play } from "lucide-react";
import { setGroupStatusAction } from "@/app/(dashboard)/settings/actions";
import type { GroupRecord, GroupStatus } from "@/lib/data/groups";
import { Code } from "@/components/ui/code";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_HUE: Record<GroupStatus, string> = {
  active: "var(--st-green)",
  paused: "var(--st-amber)",
  pending: "var(--st-neutral)",
  blocked: "var(--st-red)",
};

const STATUS_HINT: Record<GroupStatus, string> = {
  active: "Capturing messages",
  paused: "Not capturing — history kept",
  pending: "Waiting for approval — messages are being discarded",
  blocked: "Blocked",
};

export function GroupManager({
  groups,
  counts,
  canManage,
}: {
  groups: GroupRecord[];
  counts: Record<string, number>;
  canManage: boolean;
}) {
  if (groups.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted">
        No LINE groups yet. Add the LINE official account to a group chat and it
        will appear here for approval.
      </div>
    );
  }

  return (
    <div className="divide-y divide-line">
      {groups.map((g) => (
        <GroupRow
          key={g.id}
          group={g}
          count={counts[g.id] ?? 0}
          canManage={canManage}
        />
      ))}
    </div>
  );
}

function GroupRow({
  group,
  count,
  canManage,
}: {
  group: GroupRecord;
  count: number;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hue = STATUS_HUE[group.status];
  const isActive = group.status === "active";

  const set = (status: GroupStatus) => {
    setError(null);
    startTransition(async () => {
      const r = await setGroupStatusAction(group.id, status);
      if (!r.ok) setError(r.error ?? "Failed");
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-thai text-sm font-medium text-ink">
            {group.name}
          </span>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium capitalize"
            style={{ color: hue, backgroundColor: `${hue}14` }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: hue }}
            />
            {group.status}
          </span>
        </div>
        <Code muted className="text-2xs">
          {group.lineGroupId}
        </Code>
        <div className="mt-0.5 text-2xs text-faint">
          {STATUS_HINT[group.status]}
          {group.lastMessageAt && ` · last message ${formatDateTime(group.lastMessageAt)}`}
        </div>
        {error && <div className="mt-0.5 text-2xs text-[var(--st-red)]">{error}</div>}
      </div>

      <div className="text-right">
        <div className="font-mono text-sm tabular text-ink-soft">{count}</div>
        <div className="text-2xs text-faint">captured</div>
      </div>

      {count > 0 && (
        <Link
          href={`/messages?group=${group.id}`}
          className="text-2xs font-medium text-accent hover:text-accent-ink"
        >
          View
        </Link>
      )}

      {canManage && (
        <button
          onClick={() => set(isActive ? "paused" : "active")}
          disabled={pending}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-medium disabled:opacity-60",
            isActive
              ? "border-line text-ink-soft hover:border-line-strong hover:bg-panel"
              : "border-accent bg-accent text-white hover:bg-accent-ink",
          )}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isActive ? (
            <Pause className="h-3.5 w-3.5" />
          ) : group.status === "pending" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {isActive ? "Pause" : group.status === "pending" ? "Approve" : "Resume"}
        </button>
      )}
    </div>
  );
}
