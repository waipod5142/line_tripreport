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
  attachmentName: string | null;
  /** Stored attachments viewable via a signed URL (empty until retrieved). */
  attachments?: MessageAttachment[];
}
