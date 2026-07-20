"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { summariseTrip } from "@/lib/ai/summariser";
import { EVENT_LABELS } from "@/lib/lifecycle";
import type { EventType } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const WRITER_ROLES = ["system_administrator", "operations_manager", "dispatcher"];

export interface ResummariseResult {
  ok: boolean;
  error?: string;
}

/**
 * Regenerate a trip's rolling summary (Thai + English) from its current facts,
 * events, and source messages. Writer-only. Runs synchronously (~50s).
 */
export async function resummariseTripAction(
  tripId: string,
): Promise<ResummariseResult> {
  const user = await getCurrentUser();
  if (!user?.profile) return { ok: false, error: "Not authorized." };
  if (!WRITER_ROLES.includes(user.profile.role)) {
    return { ok: false, error: "You don’t have permission to re-summarise." };
  }

  const admin = createAdminClient();

  const { data: trip } = await admin
    .from("trips")
    .select(
      "id, shipment_code, normalized_shipment_code, origin_name, destination_name, status, planned_delivery_at",
    )
    .eq("id", tripId)
    .single();
  if (!trip) return { ok: false, error: "Trip not found." };

  const { data: evData } = await admin
    .from("trip_events")
    .select("event_type, event_at")
    .eq("trip_id", tripId)
    .eq("is_void", false)
    .order("event_at", { ascending: true });
  const events = ((evData ?? []) as { event_type: string; event_at: string | null }[]).map(
    (e) =>
      `${EVENT_LABELS[e.event_type as EventType] ?? e.event_type} @ ${formatDateTime(e.event_at)}`,
  );

  const { data: tvData } = await admin
    .from("trip_vehicles")
    .select("role, vehicles ( registration_display )")
    .eq("trip_id", tripId);
  const tv = (tvData ?? []) as unknown as {
    role: string;
    vehicles: { registration_display: string } | null;
  }[];
  const tractor = tv.find((v) => v.role === "tractor")?.vehicles?.registration_display;
  const trailer = tv.find((v) => v.role === "trailer")?.vehicles?.registration_display;

  const { data: tdData } = await admin
    .from("trip_drivers")
    .select("drivers ( name_th )")
    .eq("trip_id", tripId)
    .limit(1);
  const td = (tdData ?? []) as unknown as { drivers: { name_th: string | null } | null }[];
  const driver = td[0]?.drivers?.name_th ?? null;

  const { data: linkData } = await admin
    .from("message_trip_links")
    .select("message_id")
    .eq("trip_id", tripId);
  const ids = ((linkData ?? []) as { message_id: string }[]).map((l) => l.message_id);

  let messages: string[] = [];
  if (ids.length > 0) {
    const { data: msgData } = await admin
      .from("line_messages")
      .select("text_content, sent_at")
      .in("id", ids)
      .not("text_content", "is", null)
      .order("sent_at", { ascending: true });
    messages = ((msgData ?? []) as { text_content: string | null }[])
      .map((m) => m.text_content)
      .filter((t): t is string => Boolean(t));
  }

  try {
    const summary = await summariseTrip({
      shipmentCode: trip.shipment_code ?? trip.normalized_shipment_code ?? "—",
      route: `${trip.origin_name ?? "?"} → ${trip.destination_name ?? "?"}`,
      status: trip.status,
      driver,
      vehicles: `${tractor ?? "?"} / ${trailer ?? "?"}`,
      plannedDelivery: trip.planned_delivery_at
        ? formatDateTime(trip.planned_delivery_at)
        : null,
      events,
      messages,
    });

    await admin
      .from("trips")
      .update({ summary_th: summary.summaryThai, summary_en: summary.summaryEnglish })
      .eq("id", tripId);
    revalidatePath(`/trips/${tripId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
