import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isStage, type EventStatus, type StageEvent } from "@/lib/shipments/stages";

export interface ShipmentRow {
  id: string;
  shipmentNo: string;
  planDate: string;
  deliveryDate: string | null;
  deliveryDateEnd: string | null;
  timeWindow: string | null;
  shipToName: string | null;
  city: string | null;
  province: string | null;
  qty: number | null;
  pallets: number | null;
  plate: string | null;
  driverName: string | null;
  driverPhone: string | null;
  section: "loaded" | "pending" | null;
  events: StageEvent[];
}

interface DbShipment {
  id: string;
  shipment_no: string;
  plan_date: string;
  delivery_date: string | null;
  delivery_date_end: string | null;
  time_window: string | null;
  ship_to_name: string | null;
  city: string | null;
  province: string | null;
  qty: number | null;
  pallets: number | null;
  plate: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  section: "loaded" | "pending" | null;
  shipment_events: { stage: string; status: string; occurred_at: string }[];
}

/**
 * Plan days that have shipments, newest first. Reads plan_date only; a few
 * hundred rows at most, deduplicated here rather than with a view.
 */
export async function listPlanDates(limit = 60): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("plan_date")
    .order("plan_date", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`listPlanDates: ${error.message}`);
  const rows = data as unknown as { plan_date: string }[];
  return [...new Set(rows.map((r) => r.plan_date))].slice(0, limit);
}

/** Every shipment on one plan day, with its stage events. RLS scopes to the org. */
export async function listShipments(planDate: string): Promise<ShipmentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, shipment_no, plan_date, delivery_date, delivery_date_end, time_window, ship_to_name, city, province, qty, pallets, plate, driver_name, driver_phone, section, shipment_events(stage, status, occurred_at)",
    )
    .eq("plan_date", planDate)
    .order("section", { ascending: true, nullsFirst: false })
    .order("delivery_date", { ascending: true, nullsFirst: false })
    .order("shipment_no", { ascending: true });
  if (error) throw new Error(`listShipments: ${error.message}`);

  return (data as unknown as DbShipment[]).map((s) => ({
    id: s.id,
    shipmentNo: s.shipment_no,
    planDate: s.plan_date,
    deliveryDate: s.delivery_date,
    deliveryDateEnd: s.delivery_date_end,
    timeWindow: s.time_window,
    shipToName: s.ship_to_name,
    city: s.city,
    province: s.province,
    qty: s.qty,
    pallets: s.pallets,
    plate: s.plate,
    driverName: s.driver_name,
    driverPhone: s.driver_phone,
    section: s.section,
    events: s.shipment_events.flatMap((e) =>
      isStage(e.stage)
        ? [{ stage: e.stage, status: e.status as EventStatus, occurredAt: e.occurred_at }]
        : [],
    ),
  }));
}

export interface ShipmentEventDetail extends StageEvent {
  id: string;
  source: "rule" | "manual";
  lineMessageId: string | null;
  message: {
    text: string | null;
    sentAt: string;
    isUnsent: boolean;
    sender: string | null;
    group: string | null;
  } | null;
  reviewedBy: string | null;
}

export interface ShipmentDetail extends Omit<ShipmentRow, "events"> {
  shipToCode: string | null;
  events: ShipmentEventDetail[];
}

interface DbEventDetail {
  id: string;
  stage: string;
  status: string;
  source: string;
  occurred_at: string;
  line_message_id: string | null;
  reviewer: { display_name: string | null } | null;
  line_messages: {
    text_content: string | null;
    sent_at: string;
    is_unsent: boolean;
    line_members: { display_name: string | null } | null;
    line_groups: { group_name: string | null } | null;
  } | null;
}

/** One shipment with every stage event and the message behind it. RLS-scoped. */
export async function getShipmentDetail(shipmentNo: string): Promise<ShipmentDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select(
      `id, shipment_no, plan_date, delivery_date, delivery_date_end, time_window,
       ship_to_code, ship_to_name, city, province, qty, pallets, plate, driver_name,
       driver_phone, section,
       shipment_events(
         id, stage, status, source, occurred_at, line_message_id,
         reviewer:profiles(display_name),
         line_messages(text_content, sent_at, is_unsent,
           line_members(display_name), line_groups(group_name))
       )`,
    )
    .eq("shipment_no", shipmentNo)
    .maybeSingle();
  if (error) throw new Error(`getShipmentDetail: ${error.message}`);
  if (!data) return null;

  const s = data as unknown as Omit<DbShipment, "shipment_events"> & {
    ship_to_code: string | null;
    shipment_events: DbEventDetail[];
  };

  const events: ShipmentEventDetail[] = s.shipment_events
    .flatMap((e) => {
      if (!isStage(e.stage)) return [];
      const m = e.line_messages;
      return [
        {
          id: e.id,
          stage: e.stage,
          status: e.status as EventStatus,
          source: e.source as "rule" | "manual",
          occurredAt: e.occurred_at,
          lineMessageId: e.line_message_id,
          reviewedBy: e.reviewer?.display_name ?? null,
          message: m
            ? {
                text: m.text_content,
                sentAt: m.sent_at,
                isUnsent: m.is_unsent,
                sender: m.line_members?.display_name ?? null,
                group: m.line_groups?.group_name ?? null,
              }
            : null,
        },
      ];
    })
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return {
    id: s.id,
    shipmentNo: s.shipment_no,
    planDate: s.plan_date,
    deliveryDate: s.delivery_date,
    deliveryDateEnd: s.delivery_date_end,
    timeWindow: s.time_window,
    shipToCode: s.ship_to_code,
    shipToName: s.ship_to_name,
    city: s.city,
    province: s.province,
    qty: s.qty,
    pallets: s.pallets,
    plate: s.plate,
    driverName: s.driver_name,
    driverPhone: s.driver_phone,
    section: s.section,
    events,
  };
}
