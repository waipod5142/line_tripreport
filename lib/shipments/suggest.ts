import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  extractShipmentNumbers,
  suggestedEventRows,
  type MessageForSuggestion,
} from "./extract";

// Writes stage SUGGESTIONS to shipment_events. Three callers:
//   • ingest       — each new text message, as it arrives
//   • plan import  — re-scans the archive for the numbers just imported, so a
//                    driver who reported before the plan was uploaded still counts
//   • backfill job — every imported shipment, after the rules change
//
// Uses the service-role client, which bypasses RLS: every query here filters
// on organization_id explicitly, and callers outside ingest must have done
// their own role check (see CLAUDE.md).
//
// Inserts use ignoreDuplicates on (shipment_id, line_message_id, stage). That
// makes re-processing idempotent AND means a re-run can never flip an event a
// person already confirmed or rejected back to 'suggested'.

type Admin = ReturnType<typeof createAdminClient>;

// Keeps PostgREST .in()/.or() URLs well under proxy limits.
const CHUNK = 40;

function chunks<T>(xs: T[], n = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

async function shipmentIds(
  admin: Admin,
  orgId: string,
  shipmentNos: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const batch of chunks(shipmentNos)) {
    const { data, error } = await admin
      .from("shipments")
      .select("id, shipment_no")
      .eq("organization_id", orgId)
      .in("shipment_no", batch);
    if (error) throw error;
    for (const s of data) map.set(s.shipment_no, s.id);
  }
  return map;
}

async function insertSuggestions(
  admin: Admin,
  orgId: string,
  messages: MessageForSuggestion[],
  ids: Map<string, string>,
): Promise<number> {
  const rows = suggestedEventRows(messages, ids).map((r) => ({
    ...r,
    organization_id: orgId,
    source: "rule",
    status: "suggested",
  }));
  if (rows.length === 0) return 0;

  const { data, error } = await admin
    .from("shipment_events")
    .upsert(rows, {
      onConflict: "shipment_id,line_message_id,stage",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) throw error;
  return data.length;
}

/** Ingest path: one freshly stored text message. Returns suggestions created. */
export async function suggestFromMessage(
  admin: Admin,
  orgId: string,
  message: MessageForSuggestion,
): Promise<number> {
  if (!message.text) return 0;
  const nos = extractShipmentNumbers(message.text);
  if (nos.length === 0) return 0;
  const ids = await shipmentIds(admin, orgId, nos);
  if (ids.size === 0) return 0;
  return insertSuggestions(admin, orgId, [message], ids);
}

/**
 * Re-scan the archive for messages mentioning these shipments. With no
 * numbers given, scans for every shipment the org has imported.
 */
export async function suggestFromArchive(
  admin: Admin,
  orgId: string,
  shipmentNos?: string[],
): Promise<{ shipments: number; messages: number; created: number }> {
  let nos = shipmentNos;
  if (!nos) {
    const { data, error } = await admin
      .from("shipments")
      .select("shipment_no")
      .eq("organization_id", orgId);
    if (error) throw error;
    nos = data.map((s) => s.shipment_no);
  }
  // Only digits reach the filter below; the DB check constraint guarantees it
  // for stored numbers, this guards caller-supplied ones.
  nos = [...new Set(nos.filter((n) => /^\d{7}$/.test(n)))];
  if (nos.length === 0) return { shipments: 0, messages: 0, created: 0 };

  const ids = await shipmentIds(admin, orgId, nos);
  let messages = 0;
  let created = 0;

  for (const batch of chunks([...ids.keys()])) {
    const { data, error } = await admin
      .from("line_messages")
      .select("id, text_content, sent_at")
      .eq("organization_id", orgId)
      .eq("message_type", "text")
      .eq("is_unsent", false)
      .or(batch.map((n) => `text_content.ilike.%${n}%`).join(","))
      .order("sent_at", { ascending: true })
      .limit(5000);
    if (error) throw error;

    messages += data.length;
    created += await insertSuggestions(
      admin,
      orgId,
      data.map((m) => ({ id: m.id, text: m.text_content, sentAt: m.sent_at })),
      ids,
    );
  }

  return { shipments: ids.size, messages, created };
}

/**
 * A driver unsent a message: pending suggestions drawn from it are rejected.
 * Confirmed events are left alone — a person already vouched for them.
 */
export async function rejectSuggestionsForMessages(
  admin: Admin,
  messageIds: string[],
): Promise<void> {
  if (messageIds.length === 0) return;
  const { error } = await admin
    .from("shipment_events")
    .update({ status: "rejected" })
    .in("line_message_id", messageIds)
    .eq("status", "suggested");
  if (error) throw error;
}
