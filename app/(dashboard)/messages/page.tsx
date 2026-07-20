import { PageHeader } from "@/components/ui/page-header";
import { MessageInbox } from "@/components/messages/message-inbox";
import { getMessages } from "@/lib/mock/data";

export default function MessagesPage() {
  const messages = getMessages();
  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Message inbox"
        description="Every captured LINE message, preserved with its source metadata. Non-operational messages stay searchable but never create trips."
      />
      <MessageInbox messages={messages} />
    </>
  );
}
