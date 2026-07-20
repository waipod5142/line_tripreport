import type { EventType, TripStatus } from "./types";

// The trip lifecycle as an honest sequence. The journey rail renders this
// order and marks where each trip currently sits.

export interface StatusMeta {
  key: TripStatus;
  labelEn: string;
  labelTh: string;
  /** CSS var for the status dot / accent. */
  hue: string;
  /** Position in the main journey (null = off-path: draft/cancelled/exception). */
  stage: number | null;
}

export const STATUS_META: Record<TripStatus, StatusMeta> = {
  draft: { key: "draft", labelEn: "Draft", labelTh: "ฉบับร่าง", hue: "var(--st-neutral)", stage: null },
  assigned: { key: "assigned", labelEn: "Assigned", labelTh: "มอบหมายแล้ว", hue: "var(--st-blue)", stage: 0 },
  at_origin: { key: "at_origin", labelEn: "At origin", labelTh: "ถึงต้นทาง", hue: "var(--st-teal)", stage: 1 },
  border_processing: { key: "border_processing", labelEn: "Border", labelTh: "กำลังผ่านด่าน", hue: "var(--st-amber)", stage: 2 },
  released: { key: "released", labelEn: "Released", labelTh: "ผ่านด่านแล้ว", hue: "var(--st-green)", stage: 3 },
  in_transit: { key: "in_transit", labelEn: "In transit", labelTh: "กำลังขนส่ง", hue: "var(--st-accent)", stage: 4 },
  arrived: { key: "arrived", labelEn: "Arrived", labelTh: "ถึงปลายทาง", hue: "var(--st-indigo)", stage: 5 },
  loading: { key: "loading", labelEn: "Loading", labelTh: "กำลังขึ้นสินค้า", hue: "var(--st-violet)", stage: 6 },
  unloading: { key: "unloading", labelEn: "Unloading", labelTh: "กำลังลงสินค้า", hue: "var(--st-violet)", stage: 6 },
  completed: { key: "completed", labelEn: "Completed", labelTh: "เสร็จสิ้น", hue: "var(--st-green)", stage: 7 },
  cancelled: { key: "cancelled", labelEn: "Cancelled", labelTh: "ยกเลิก", hue: "var(--st-neutral)", stage: null },
  exception: { key: "exception", labelEn: "Exception", labelTh: "มีปัญหา", hue: "var(--st-red)", stage: null },
};

/** Ordered stages shown on the journey rail. */
export const JOURNEY_STAGES: { labelEn: string; labelTh: string }[] = [
  { labelEn: "Assigned", labelTh: "มอบหมาย" },
  { labelEn: "At origin", labelTh: "ต้นทาง" },
  { labelEn: "Border", labelTh: "ด่าน" },
  { labelEn: "Released", labelTh: "ผ่านด่าน" },
  { labelEn: "In transit", labelTh: "ขนส่ง" },
  { labelEn: "Arrived", labelTh: "ถึงปลายทาง" },
  { labelEn: "Unloading", labelTh: "ลงสินค้า" },
  { labelEn: "Completed", labelTh: "เสร็จสิ้น" },
];

export const EVENT_LABELS: Record<EventType, string> = {
  assignment_created: "Assignment created",
  arrived_origin: "Arrived at origin",
  loaded_container_received: "Loaded container received",
  customs_lao_released: "Lao customs released",
  customs_thai_released: "Thai customs released",
  departed_origin: "Departed origin",
  arrived_destination: "Arrived at destination",
  loading_started: "Loading started",
  loading_completed: "Loading completed",
  unloading_started: "Unloading started",
  unloading_completed: "Unloading completed",
  trip_completed: "Trip completed",
  trip_cancelled: "Trip cancelled",
  status_note: "Status note",
};
