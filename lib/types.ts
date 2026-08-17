// Domain types for the message archive UI.

export interface MessageAttachment {
  id: string;
  filename: string;
  mimeType: string | null;
  kind: "image" | "file";
}

export interface LineMessage {
  id: string;
  lineMessageId: string;
  group: string;
  senderName: string;
  messageType: "text" | "image" | "file" | "location" | "sticker";
  text: string | null;
  sentAt: string;
  /**
   * How the message was captured. These values predate the removal of the AI
   * pipeline, so historical rows still carry `processed` / `review_required`;
   * new messages only ever land as `queued` (text), `stored` (media) or
   * `processed` (everything else).
   */
  processingStatus:
    | "received"
    | "stored"
    | "queued"
    | "processing"
    | "processed"
    | "review_required"
    | "failed";
  attachmentName: string | null;
  /** Stored attachments viewable via a signed URL (empty until retrieved). */
  attachments?: MessageAttachment[];
}
