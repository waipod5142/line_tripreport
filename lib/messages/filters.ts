// The message-inbox filter contract. Shared by the paginated list and the CSV
// export so both always describe the same slice of data — the export is defined
// as "everything matching what you're looking at", not "what happened to be
// loaded in the browser".

export interface MessageFilters {
  /** Free-text search over message body, sender, group and attachment name. */
  q: string;
  /** A message_type value, or "all". */
  type: string;
  /** A processing_status value, or "all". */
  status: string;
  /** A line_groups.id (UUID), or "all". */
  group: string;
}

/** Types offered in the filter dropdown. Anything else is coerced to "all". */
export const FILTERABLE_TYPES = ["text", "image", "file", "location", "sticker"] as const;

/** Statuses offered in the filter dropdown. Anything else is coerced to "all". */
export const FILTERABLE_STATUSES = [
  "received",
  "stored",
  "queued",
  "processing",
  "processed",
  "review_required",
  "failed",
] as const;

export const EMPTY_FILTERS: MessageFilters = {
  q: "",
  type: "all",
  status: "all",
  group: "all",
};

/**
 * Groups are rows, not a fixed vocabulary, so the group filter can't be
 * whitelisted the way type and status are — a new group must work the moment
 * it's activated, with no code change. Instead the value is required to be
 * UUID-shaped, which is enough to keep a hand-edited URL from reaching the
 * PostgREST filter grammar; authorization is RLS's job, and a well-formed id
 * belonging to another org simply matches no rows.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rows per page in the inbox list. */
export const PAGE_SIZE = 50;

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/**
 * Read filters out of URL search params, coercing anything unrecognised to a
 * safe default. Values reach Supabase as equality filters, so whitelisting here
 * is what keeps a hand-edited URL from probing arbitrary column values.
 */
export function parseMessageFilters(params: RawParams): MessageFilters {
  const type = first(params.type);
  const status = first(params.status);
  const group = first(params.group);
  return {
    q: first(params.q).trim().slice(0, 200),
    type: (FILTERABLE_TYPES as readonly string[]).includes(type) ? type : "all",
    status: (FILTERABLE_STATUSES as readonly string[]).includes(status) ? status : "all",
    group: UUID_RE.test(group) ? group.toLowerCase() : "all",
  };
}

/** 1-based page number from URL search params; out-of-range values clamp to 1. */
export function parsePage(params: RawParams): number {
  const n = Number.parseInt(first(params.page), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Serialize filters (and optionally a page) back into a query string. Defaults
 * are omitted so the common case stays a clean `/messages` URL.
 */
export function filtersToQuery(filters: MessageFilters, page?: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.group !== "all") params.set("group", filters.group);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.status !== "all") params.set("status", filters.status);
  if (page && page > 1) params.set("page", String(page));
  return params.toString();
}

export function hasActiveFilters(filters: MessageFilters): boolean {
  return (
    filters.q !== "" ||
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.group !== "all"
  );
}

/**
 * Quote a value for use inside a PostgREST `or=(...)` filter string.
 *
 * The `or` filter is a comma/parenthesis-delimited mini-language, so an
 * unquoted search term containing `,` `.` `(` `)` would silently change which
 * rows come back. PostgREST accepts a double-quoted value where `"` and `\`
 * are backslash-escaped.
 */
export function pgrstQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
