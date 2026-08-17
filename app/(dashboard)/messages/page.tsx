import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { MessageInbox } from "@/components/messages/message-inbox";
import { listMessagesPage } from "@/lib/data/messages";
import {
  filtersToQuery,
  hasActiveFilters,
  parseMessageFilters,
  parsePage,
  PAGE_SIZE,
} from "@/lib/messages/filters";

// Always read fresh from Supabase (new messages arrive continuously).
export const dynamic = "force-dynamic";
// The manual "Run AI" server action calls kimi-k3 (~50s), so allow the max.
export const maxDuration = 60;

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseMessageFilters(params);
  const page = parsePage(params);

  const { rows, total, pageCount } = await listMessagesPage(filters, page);

  // Narrowing the filters can strand the reader past the last page.
  if (page > pageCount && total > 0) {
    const query = filtersToQuery(filters, pageCount);
    redirect(query ? `/messages?${query}` : "/messages");
  }

  const unfiltered = !hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Message inbox"
        description="Every captured LINE message, preserved with its source metadata. Non-operational messages stay searchable but never create trips."
      />
      {total === 0 && unfiltered ? (
        <div className="rounded-md border border-line bg-panel px-4 py-16 text-center">
          <p className="text-sm font-medium text-ink">No messages captured yet</p>
          <p className="mt-1 text-xs text-muted">
            Post a message in an active LINE group — it appears here within seconds.
          </p>
        </div>
      ) : (
        <MessageInbox
          messages={rows}
          filters={filters}
          total={total}
          page={page}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
        />
      )}
    </>
  );
}
