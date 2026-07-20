import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BANGKOK_TZ = "Asia/Bangkok";

/** Display an ISO timestamp in the organization timezone (Asia/Bangkok). */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BANGKOK_TZ,
  }).format(new Date(iso));
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: BANGKOK_TZ,
  }).format(new Date(iso));
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BANGKOK_TZ,
  }).format(new Date(iso));
}

/** Relative age, e.g. "3h ago". Defaults to the real current time. */
export function timeAgo(iso: string | null, now = new Date().toISOString()): string {
  if (!iso) return "—";
  const diffMs = new Date(now).getTime() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 0) return "just now";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Fixed reference "now" so mock relative times are deterministic. */
export const MOCK_NOW = "2026-07-19T14:30:00+07:00";
