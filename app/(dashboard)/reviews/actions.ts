"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data/session";
import { acceptReviewItem, dismissReviewItem } from "@/lib/trips/apply-extraction";

const WRITER_ROLES = ["system_administrator", "operations_manager", "dispatcher"];

export interface ReviewActionResult {
  ok: boolean;
  error?: string;
  tripId?: string | null;
}

/** Accept a review item — applies its extraction to the trip. Writer-only. */
export async function acceptReviewAction(
  reviewItemId: string,
): Promise<ReviewActionResult> {
  const user = await getCurrentUser();
  if (!user?.profile) return { ok: false, error: "Not authorized." };
  if (!WRITER_ROLES.includes(user.profile.role)) {
    return { ok: false, error: "You don’t have permission to accept reviews." };
  }

  const r = await acceptReviewItem(reviewItemId, user.id);
  if (r.ok) {
    revalidatePath("/reviews");
    if (r.tripId) revalidatePath(`/trips/${r.tripId}`);
  }
  return { ok: r.ok, error: r.error, tripId: r.tripId };
}

/** Dismiss a review item — no trip changes. Writer-only. */
export async function dismissReviewAction(
  reviewItemId: string,
): Promise<ReviewActionResult> {
  const user = await getCurrentUser();
  if (!user?.profile) return { ok: false, error: "Not authorized." };
  if (!WRITER_ROLES.includes(user.profile.role)) {
    return { ok: false, error: "You don’t have permission to dismiss reviews." };
  }

  const r = await dismissReviewItem(reviewItemId, user.id);
  if (r.ok) revalidatePath("/reviews");
  return { ok: r.ok, error: r.error };
}
