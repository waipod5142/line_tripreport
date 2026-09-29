"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isOrgWriter } from "@/lib/data/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { suggestFromArchive } from "@/lib/shipments/suggest";
import { parseIsoDate } from "@/lib/shipments/filters";
import { parsePlanCsv } from "@/lib/shipments/plan-parse";
import { isStage, type EventStatus, type Stage } from "@/lib/shipments/stages";
import { bangkokLocalToIso } from "@/lib/shipments/time";
import type { TablesInsert } from "@/lib/supabase/types";

export interface ImportPlanResult {
  ok: boolean;
  error?: string;
  planDate?: string;
  imported?: number;
  /** Stage suggestions created from messages already in the archive. */
  suggested?: number;
  warnings?: string[];
}

// A day's plan is a few dozen rows; anything near this is the wrong file.
const MAX_CSV_CHARS = 2_000_000;

/**
 * Import the customer's daily plan (CSV exported from the Excel sheet).
 *
 * The browser parses the same file for its preview, but that parse is never
 * trusted: the CSV text is re-parsed here. Writes go through the RLS client, so
 * the shipments_write policy (org match + is_org_writer) is enforced by the
 * database as well as by the role check below.
 *
 * Upserts on (organization_id, shipment_no): re-uploading a plan, or a later
 * plan that carries a shipment over under ขึ้นค้างส่ง, updates the existing row —
 * moving it to the newer plan day — and keeps its stage events.
 */
export async function importPlanAction(
  csv: string,
  fallbackPlanDate?: string,
): Promise<ImportPlanResult> {
  const user = await getCurrentUser();
  if (!user?.profile) return { ok: false, error: "Not authorized." };
  if (!isOrgWriter(user)) {
    return { ok: false, error: "Only dispatchers and managers can import a plan." };
  }
  if (typeof csv !== "string" || csv.length === 0) {
    return { ok: false, error: "The file is empty." };
  }
  if (csv.length > MAX_CSV_CHARS) {
    return { ok: false, error: "That file is far larger than a daily plan." };
  }

  // From the file name or the date picker — used only when the CSV has no
  // title row. Validated here: it becomes plan_date on every row.
  const fallback = parseIsoDate(fallbackPlanDate) ?? undefined;
  const plan = parsePlanCsv(csv, fallback);
  if (plan.rows.length === 0) {
    return {
      ok: false,
      error: plan.warnings[0] ?? "No shipments found in the file.",
      warnings: plan.warnings,
    };
  }

  const rows: TablesInsert<"shipments">[] = plan.rows.map((r) => ({
    ...r,
    organization_id: user.profile!.organizationId,
  }));

  // @supabase/ssr 0.5.2 collapses write payloads to `never` (the same gap as
  // .rpc() — see fetchKeywordCounts in lib/data/stats.ts). `rows` is checked
  // against the generated Insert type above; only the call boundary is cast.
  const supabase = await createClient();
  const { error } = await supabase
    .from("shipments")
    .upsert(rows as never, { onConflict: "organization_id,shipment_no" });
  if (error) return { ok: false, error: error.message, warnings: plan.warnings };

  // Drivers often report before the plan is uploaded. Pick those messages up
  // now. Service-role client: the writer check above is the authorization, and
  // suggestFromArchive filters every query on this org.
  const warnings = [...plan.warnings];
  let suggested = 0;
  try {
    const r = await suggestFromArchive(
      createAdminClient(),
      user.profile.organizationId,
      plan.rows.map((r) => r.shipment_no),
    );
    suggested = r.created;
  } catch (err) {
    warnings.push(
      `Shipments imported, but scanning earlier LINE messages failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  revalidatePath("/shipments");
  return {
    ok: true,
    planDate: plan.planDate,
    imported: plan.rows.length,
    suggested,
    warnings,
  };
}

// ── Reviewing stage events ─────────────────────────────────────────────────
//
// A suggestion is a keyword rule's guess. A person turns it into fact
// (confirmed), throws it out (rejected), or says the rule picked the wrong
// stage (move). Only confirmed events count toward progress — see
// lib/shipments/stages.ts. Every write goes through the RLS client, so the
// shipment_events_write policy (same org + writer role) is enforced by the
// database, not only by the role check here.

export interface EventActionResult {
  ok: boolean;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS: EventStatus[] = ["confirmed", "rejected", "suggested"];
// Manual times may run slightly ahead of the server clock, not into tomorrow.
const FUTURE_SLACK_MS = 10 * 60_000;

async function requireWriter() {
  const user = await getCurrentUser();
  return user?.profile && isOrgWriter(user) ? { id: user.id, ...user.profile } : null;
}

/** Confirm, reject, or return to 'suggested' (undo) one event. */
export async function reviewEventAction(
  eventId: string,
  decision: EventStatus,
): Promise<EventActionResult> {
  const user = await requireWriter();
  if (!user) return { ok: false, error: "Only dispatchers and managers can review stages." };
  if (!UUID.test(eventId) || !DECISIONS.includes(decision)) {
    return { ok: false, error: "Invalid request." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipment_events")
    .update({ status: decision, confirmed_by: decision === "suggested" ? null : user.id } as never)
    .eq("id", eventId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Event not found." };

  revalidatePath("/shipments", "layout");
  return { ok: true };
}

/**
 * The rule read the message as the wrong stage. Records the message under the
 * right stage (confirmed, source 'manual') and rejects the original, so the
 * history shows both what the rule said and what a person decided.
 */
export async function moveEventStageAction(
  eventId: string,
  stage: Stage,
): Promise<EventActionResult> {
  const user = await requireWriter();
  if (!user) return { ok: false, error: "Only dispatchers and managers can review stages." };
  if (!UUID.test(eventId) || !isStage(stage)) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { data: found, error: readErr } = await supabase
    .from("shipment_events")
    .select("organization_id, shipment_id, line_message_id, occurred_at, stage")
    .eq("id", eventId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  const ev = found as unknown as {
    organization_id: string;
    shipment_id: string;
    line_message_id: string | null;
    occurred_at: string;
    stage: string;
  } | null;
  if (!ev) return { ok: false, error: "Event not found." };
  if (ev.stage === stage) return reviewEventAction(eventId, "confirmed");

  const moved: TablesInsert<"shipment_events"> = {
    organization_id: ev.organization_id,
    shipment_id: ev.shipment_id,
    line_message_id: ev.line_message_id,
    occurred_at: ev.occurred_at,
    stage,
    source: "manual",
    status: "confirmed",
    confirmed_by: user.id,
  };
  // If the rule had also suggested this message for the target stage, that
  // row is updated in place rather than duplicated.
  const { error: insErr } = await supabase
    .from("shipment_events")
    .upsert(moved as never, { onConflict: "shipment_id,line_message_id,stage" });
  if (insErr) return { ok: false, error: insErr.message };

  return reviewEventAction(eventId, "rejected");
}

/**
 * Record a stage with no LINE message behind it — the driver phoned, or the
 * checker saw the truck leave. `localTime` is Bangkok wall-clock from a
 * datetime-local input.
 */
export async function recordStageAction(
  shipmentId: string,
  stage: Stage,
  localTime: string,
): Promise<EventActionResult> {
  const user = await requireWriter();
  if (!user) return { ok: false, error: "Only dispatchers and managers can record stages." };
  if (!UUID.test(shipmentId) || !isStage(stage)) return { ok: false, error: "Invalid request." };

  const occurredAt = bangkokLocalToIso(localTime);
  if (!occurredAt) return { ok: false, error: "Enter a valid date and time." };
  if (new Date(occurredAt).getTime() > Date.now() + FUTURE_SLACK_MS) {
    return { ok: false, error: "That time is in the future." };
  }

  // The events policy checks the event's organization_id, not that shipment_id
  // belongs to the same org. Reading the shipment through RLS first closes
  // that: another org's shipment is simply not found.
  const supabase = await createClient();
  const { data: found } = await supabase
    .from("shipments")
    .select("id, organization_id")
    .eq("id", shipmentId)
    .maybeSingle();
  const shipment = found as unknown as { id: string; organization_id: string } | null;
  if (!shipment) return { ok: false, error: "Shipment not found." };

  const row: TablesInsert<"shipment_events"> = {
    organization_id: shipment.organization_id,
    shipment_id: shipment.id,
    line_message_id: null,
    occurred_at: occurredAt,
    stage,
    source: "manual",
    status: "confirmed",
    confirmed_by: user.id,
  };
  const { error } = await supabase.from("shipment_events").insert(row as never);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/shipments", "layout");
  return { ok: true };
}
