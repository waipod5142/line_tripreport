// Domain types for the operations UI. These mirror the PRD data model
// (section 12) but are trimmed to what the interface renders.

export type TripStatus =
  | "draft"
  | "assigned"
  | "at_origin"
  | "border_processing"
  | "released"
  | "in_transit"
  | "arrived"
  | "loading"
  | "unloading"
  | "completed"
  | "cancelled"
  | "exception";

export type ReviewStatus = "clear" | "in_review" | "review_required";

export type Classification =
  | "trip_assignment"
  | "trip_update"
  | "trip_correction"
  | "trip_cancellation"
  | "attachment_context"
  | "general_operational_notice"
  | "non_operational"
  | "unknown";

export type EventType =
  | "assignment_created"
  | "arrived_origin"
  | "loaded_container_received"
  | "customs_lao_released"
  | "customs_thai_released"
  | "departed_origin"
  | "arrived_destination"
  | "loading_started"
  | "loading_completed"
  | "unloading_started"
  | "unloading_completed"
  | "trip_completed"
  | "trip_cancelled"
  | "status_note";

export interface TripEvent {
  id: string;
  eventType: EventType;
  eventAt: string | null;
  rawLabel: string;
  description: string | null;
  sourceType: "line" | "manual" | "integration" | "system";
  sourceMessageId: string | null;
  confidence: number | null;
  confirmationStatus: "confirmed" | "unconfirmed";
}

export interface Attachment {
  id: string;
  kind: "image" | "file";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
}

export interface Trip {
  id: string;
  shipmentCode: string;
  assignmentDate: string; // ISO date
  status: TripStatus;
  manualOverride: boolean;
  origin: string;
  destination: string;
  destinationProvince: string | null;
  destinationMapUrl: string | null;
  tractor: string | null;
  trailer: string | null;
  truckBrand: string | null;
  carrierCode: string | null;
  driverNameThai: string | null;
  driverNameEnglish: string | null;
  driverPhone: string | null;
  loadedContainer: string | null;
  emptyContainer: string | null;
  plannedDeliveryAt: string | null;
  actualArrivalAt: string | null;
  completedAt: string | null;
  latestStatusText: string;
  lastUpdateAt: string;
  reviewState: ReviewStatus;
  confidence: number;
  lineGroup: string;
  summaryTh: string;
  summaryEn: string;
  events: TripEvent[];
  attachments: Attachment[];
  linkedMessageIds: string[];
}

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
  processingStatus:
    | "received"
    | "stored"
    | "queued"
    | "processing"
    | "processed"
    | "review_required"
    | "failed";
  classification: Classification | null;
  linkedTripId: string | null;
  attachmentName: string | null;
  /** Stored attachments viewable via a signed URL (empty until retrieved). */
  attachments?: MessageAttachment[];
}

export interface ReviewItem {
  id: string;
  reasonCode: string;
  reasonLabel: string;
  priority: "high" | "medium" | "low";
  createdAt: string;
  shipmentCandidate: string | null;
  tripId: string | null;
  messageId: string;
  messageText: string;
  senderName: string;
  group: string;
  confidence: number;
  proposed: { field: string; current: string | null; proposed: string | null }[];
}
