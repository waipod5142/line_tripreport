import { getCurrentUser } from "@/lib/data/session";
import { iterateMessages } from "@/lib/data/messages";
import { listInboxGroups } from "@/lib/data/groups";
import {
  CSV_BOM,
  CSV_HEADERS,
  csvFilename,
  csvLine,
  messageToCsvLine,
} from "@/lib/messages/csv";
import { parseMessageFilters } from "@/lib/messages/filters";

// Streams the full filtered result set, so the export is bounded by what the
// operator searched for rather than by what the inbox happened to load.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.profile) {
    // Not signed in, or authenticated but not allowlisted (RLS would return
    // nothing anyway — fail loudly instead of handing back an empty file).
    return new Response("Not authorized.", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filters = parseMessageFilters(Object.fromEntries(searchParams));

  // Name the file after the group when the export is scoped to one. Resolved
  // through RLS, so an id from another org just yields the undated default.
  let groupName: string | null = null;
  if (filters.group !== "all") {
    const groups = await listInboxGroups();
    groupName = groups.find((g) => g.id === filters.group)?.name ?? null;
  }

  // Advance the generator once here, inside the request scope, so the Supabase
  // client is built while the cookie store is still available and any query
  // error becomes a 500 rather than a truncated download.
  const batches = iterateMessages(filters);
  let next = await batches.next();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(CSV_BOM + csvLine(CSV_HEADERS) + "\r\n"),
      );
    },
    async pull(controller) {
      if (next.done) {
        controller.close();
        return;
      }
      const chunk =
        next.value.map(messageToCsvLine).join("\r\n") + "\r\n";
      controller.enqueue(encoder.encode(chunk));
      next = await batches.next();
    },
    cancel() {
      // Browser cancelled the download — stop querying.
      void batches.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(new Date(), groupName)}"`,
      "Cache-Control": "no-store",
    },
  });
}
