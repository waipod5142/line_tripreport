import { PageHeader } from "@/components/ui/page-header";
import { MessageInbox } from "@/components/messages/message-inbox";
import { listMessages } from "@/lib/data/messages";

// Always read fresh from Supabase (new messages arrive continuously).
export const dynamic = "force-dynamic";
// The manual "Run AI" server action calls kimi-k3 (~50s), so allow the max.
export const maxDuration = 60;

export default async function MessagesPage() {
  const messages = await listMessages();
  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Message inbox"
        description="Every captured LINE message, preserved with its source metadata. Non-operational messages stay searchable but never create trips."
      />
      {messages.length === 0 ? (
        <div className="rounded-md border border-line bg-panel px-4 py-16 text-center">
          <p className="text-sm font-medium text-ink">No messages captured yet</p>
          <p className="mt-1 text-xs text-muted">
            Post a message in an active LINE group — it appears here within seconds.
          </p>
        </div>
      ) : (
        <MessageInbox messages={messages} />
      )}
    </>
  );
}
