"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  Sticker,
} from "lucide-react";
import { getAttachmentUrlAction } from "@/app/(dashboard)/messages/actions";
import {
  filtersToQuery,
  FILTERABLE_TYPES,
  hasActiveFilters,
  type MessageFilters,
} from "@/lib/messages/filters";
import type { GroupOption } from "@/lib/data/groups";
import type { LineMessage, MessageAttachment } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const TYPE_ICON = {
  text: MessageSquare,
  image: ImageIcon,
  file: FileText,
  location: MapPin,
  sticker: Sticker,
} as const;

const TYPE_LABEL: Record<string, string> = {
  text: "Text",
  image: "Image",
  file: "File",
  location: "Location",
  sticker: "Sticker",
};

export function MessageInbox({
  messages,
  groups,
  filters,
  total,
  page,
  pageCount,
  pageSize,
}: {
  messages: LineMessage[];
  groups: GroupOption[];
  filters: MessageFilters;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q);

  // Filters live in the URL so the list, the page links and the CSV export all
  // read from one source of truth — the export can't drift from the view.
  const go = (next: MessageFilters, nextPage = 1) => {
    const q = filtersToQuery(next, nextPage);
    startTransition(() => {
      router.replace(q ? `/messages?${q}` : "/messages", { scroll: false });
    });
  };

  // Re-sync when the URL changes underneath us (back/forward, or the redirect
  // that clamps an out-of-range page).
  useEffect(() => setQuery(filters.q), [filters.q]);

  // Debounce typing so each keystroke isn't a round trip.
  useEffect(() => {
    if (query === filters.q) return;
    const t = setTimeout(() => {
      const q = filtersToQuery({ ...filters, q: query }, 1);
      startTransition(() => {
        router.replace(q ? `/messages?${q}` : "/messages", { scroll: false });
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters.q, filters.type, filters.group, router]);

  const exportQuery = filtersToQuery(filters);
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = firstRow === 0 ? 0 : firstRow + messages.length - 1;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search text, sender, group…"
            className="h-9 w-full rounded border border-line bg-panel pl-8 pr-3 text-sm text-ink placeholder:text-faint focus:border-line-strong focus:bg-canvas focus:outline-none"
          />
        </div>
        {/* Group is the primary axis: pick one and both the list and the CSV
            narrow to it. Options come from the DB, so activating a new group in
            Settings makes it selectable here with no code change. */}
        <select
          value={filters.group}
          onChange={(e) => go({ ...filters, group: e.target.value })}
          aria-label="Filter by LINE group"
          className="h-9 max-w-[220px] rounded border border-line bg-canvas px-2.5 text-sm text-ink-soft focus:border-line-strong focus:outline-none"
        >
          <option value="all">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => go({ ...filters, type: e.target.value })}
          className="h-9 rounded border border-line bg-canvas px-2.5 text-sm text-ink-soft focus:border-line-strong focus:outline-none"
        >
          <option value="all">All types</option>
          {FILTERABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        {/* A plain link, not a fetch: the browser streams the file straight to
            disk, so export size isn't bounded by what the page has loaded. */}
        <a
          href={exportQuery ? `/messages/export?${exportQuery}` : "/messages/export"}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1.5 rounded border border-line-strong bg-canvas px-3 text-sm font-medium text-ink-soft hover:bg-panel-2 hover:text-ink",
            total === 0 && "pointer-events-none opacity-50",
          )}
          aria-disabled={total === 0}
        >
          <Download className="h-4 w-4" />
          CSV
        </a>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-muted">
        <span>
          {total === 0 ? (
            "No matching messages"
          ) : (
            <>
              <span className="font-medium text-ink-soft tabular">
                {firstRow}–{lastRow}
              </span>{" "}
              of <span className="tabular">{total}</span> messages
            </>
          )}
          {hasActiveFilters(filters) && total > 0 && " matching these filters"}
        </span>
        {pending && <Loader2 className="h-3 w-3 animate-spin text-faint" />}
      </div>

      <div className="overflow-hidden rounded-md border border-line">
        <ul className="divide-y divide-line">
          {messages.map((m) => {
            const Icon = TYPE_ICON[m.messageType];
            return (
              <li key={m.id} className="flex gap-3 px-4 py-3 hover:bg-panel">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel-2 text-muted">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-thai text-sm font-medium text-ink">
                      {m.senderName}
                    </span>
                    <span className="text-2xs text-faint">{m.group}</span>
                    <span className="ml-auto font-mono text-2xs tabular text-faint">
                      {formatDateTime(m.sentAt)}
                    </span>
                  </div>

                  {m.text && (
                    <p className="mt-1 font-thai text-sm text-ink-soft">{m.text}</p>
                  )}
                  {m.attachments && m.attachments.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {m.attachments.map((a) => (
                        <AttachmentChip key={a.id} att={a} />
                      ))}
                    </div>
                  ) : (
                    m.attachmentName && (
                      <div className="mt-1 inline-flex items-center gap-1.5 rounded border border-line bg-panel px-2 py-1 font-mono text-2xs text-faint">
                        <ImageIcon className="h-3 w-3" /> {m.attachmentName}
                        <span className="text-faint">· retrieving…</span>
                      </div>
                    )
                  )}

                </div>
              </li>
            );
          })}
        </ul>
        {messages.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted">
            No messages match these filters.
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <PageLink
            filters={filters}
            page={page - 1}
            disabled={page <= 1}
            label="Previous"
          />
          <span className="font-mono text-2xs tabular text-faint">
            Page {page} of {pageCount}
          </span>
          <PageLink
            filters={filters}
            page={page + 1}
            disabled={page >= pageCount}
            label="Next"
          />
        </div>
      )}
    </div>
  );
}

function PageLink({
  filters,
  page,
  disabled,
  label,
}: {
  filters: MessageFilters;
  page: number;
  disabled: boolean;
  label: "Previous" | "Next";
}) {
  const query = filtersToQuery(filters, page);
  const Icon = label === "Previous" ? ChevronLeft : ChevronRight;
  const className = cn(
    "inline-flex h-8 items-center gap-1 rounded border border-line px-2.5 text-xs font-medium text-ink-soft",
    disabled
      ? "pointer-events-none opacity-40"
      : "hover:border-line-strong hover:bg-panel hover:text-ink",
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled>
        {label === "Previous" && <Icon className="h-3.5 w-3.5" />}
        {label}
        {label === "Next" && <Icon className="h-3.5 w-3.5" />}
      </span>
    );
  }

  return (
    <Link
      href={query ? `/messages?${query}` : "/messages"}
      scroll={false}
      className={className}
    >
      {label === "Previous" && <Icon className="h-3.5 w-3.5" />}
      {label}
      {label === "Next" && <Icon className="h-3.5 w-3.5" />}
    </Link>
  );
}

// A stored image/PDF attachment. Clicking mints a short-lived signed URL and
// opens it in a new tab. The blank tab is opened synchronously inside the click
// gesture (then redirected) so pop-up blockers don't swallow it.
function AttachmentChip({ att }: { att: MessageAttachment }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const Icon = att.kind === "image" ? ImageIcon : FileText;

  const open = () => {
    setFailed(false);
    const tab = window.open("", "_blank");
    startTransition(async () => {
      const r = await getAttachmentUrlAction(att.id);
      if (r.ok && r.url) {
        if (tab) tab.location.href = r.url;
        else window.open(r.url, "_blank");
      } else {
        tab?.close();
        setFailed(true);
      }
    });
  };

  return (
    <button
      onClick={open}
      disabled={pending}
      title={att.filename}
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-2xs transition-colors disabled:opacity-60",
        failed
          ? "border-[var(--st-red)] text-[var(--st-red)]"
          : "border-line bg-panel text-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      <span className="max-w-[220px] truncate">{att.filename}</span>
      {failed && <span>· failed</span>}
    </button>
  );
}
