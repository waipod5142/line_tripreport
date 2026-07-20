import { z } from "zod";

// LINE webhook envelope (FR-LINE-003). Validated after signature verification.
// Event internals are kept permissive (.passthrough) because we preserve the
// full raw payload anyway and LINE adds fields over time — we only strictly
// need the pieces the ingestion pipeline reads.

export const LineSourceSchema = z
  .object({
    type: z.string(), // "user" | "group" | "room"
    userId: z.string().optional(),
    groupId: z.string().optional(),
    roomId: z.string().optional(),
  })
  .passthrough();

export const LineMessageSchema = z
  .object({
    id: z.string(),
    type: z.string(), // text | image | file | video | audio | location | sticker
    text: z.string().optional(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    quotedMessageId: z.string().optional(),
    title: z.string().optional(),
    address: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .passthrough();

export const LineEventSchema = z
  .object({
    type: z.string(),
    timestamp: z.number(),
    mode: z.string().optional(),
    webhookEventId: z.string().optional(),
    deliveryContext: z.object({ isRedelivery: z.boolean() }).partial().optional(),
    source: LineSourceSchema.optional(),
    replyToken: z.string().optional(),
    message: LineMessageSchema.optional(),
    unsend: z.object({ messageId: z.string() }).optional(),
    joined: z.object({ members: z.array(LineSourceSchema) }).partial().optional(),
    left: z.object({ members: z.array(LineSourceSchema) }).partial().optional(),
  })
  .passthrough();

export const LineWebhookBodySchema = z.object({
  destination: z.string().optional(),
  events: z.array(LineEventSchema),
});

export type LineSource = z.infer<typeof LineSourceSchema>;
export type LineMessage = z.infer<typeof LineMessageSchema>;
export type LineEvent = z.infer<typeof LineEventSchema>;
export type LineWebhookBody = z.infer<typeof LineWebhookBodySchema>;

// Message types we retrieve binary content for (attachment pipeline).
export const MEDIA_MESSAGE_TYPES = ["image", "file", "video", "audio"] as const;
