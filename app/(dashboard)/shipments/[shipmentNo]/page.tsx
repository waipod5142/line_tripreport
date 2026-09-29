import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Code, CodeChip } from "@/components/ui/code";
import { StageStrip } from "@/components/shipments/stage-strip";
import { ShipmentTimeline } from "@/components/shipments/shipment-timeline";
import { getCurrentUser, isOrgWriter } from "@/lib/data/session";
import { getShipmentDetail } from "@/lib/data/shipments";
import { STAGE_LABELS, currentStage, isComplete } from "@/lib/shipments/stages";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SECTION_LABEL = { loaded: "ขึ้นแล้วส่งเลย", pending: "ขึ้นค้างส่ง" } as const;

export default async function ShipmentPage({
  params,
}: {
  params: Promise<{ shipmentNo: string }>;
}) {
  const { shipmentNo } = await params;
  if (!/^\d{7}$/.test(shipmentNo)) notFound();

  const [shipment, user] = await Promise.all([getShipmentDetail(shipmentNo), getCurrentUser()]);
  if (!shipment) notFound();

  const current = currentStage(shipment.events);
  const toReview = shipment.events.filter((e) => e.status === "suggested").length;
  const delivery =
    shipment.deliveryDateEnd && shipment.deliveryDateEnd !== shipment.deliveryDate
      ? `${formatDate(shipment.deliveryDate)} – ${formatDate(shipment.deliveryDateEnd)}`
      : formatDate(shipment.deliveryDate);

  const facts: [string, React.ReactNode][] = [
    ["Plan", <Code key="p">{formatDate(shipment.planDate)}</Code>],
    [
      "Section",
      <span key="s" className="font-thai">
        {shipment.section ? SECTION_LABEL[shipment.section] : "—"}
      </span>,
    ],
    ["Delivery", <Code key="d">{delivery}</Code>],
    ["Time window", <Code key="t">{shipment.timeWindow ?? "—"}</Code>],
    ["Ship-to code", <Code key="c">{shipment.shipToCode ?? "—"}</Code>],
    ["QTY", <Code key="q">{shipment.qty?.toLocaleString("en-US") ?? "—"}</Code>],
    ["Pallets", <Code key="pl">{shipment.pallets ?? "—"}</Code>],
    ["Truck", shipment.plate ? <CodeChip key="tr">{shipment.plate}</CodeChip> : "—"],
    ["Driver", <span key="dr" className="font-thai">{shipment.driverName ?? "—"}</span>],
    [
      "Phone",
      shipment.driverPhone ? (
        <a
          key="ph"
          href={`tel:${shipment.driverPhone.replace(/[^\d+]/g, "")}`}
          className="font-mono text-accent hover:text-accent-ink"
        >
          {shipment.driverPhone}
        </a>
      ) : (
        "—"
      ),
    ],
  ];

  return (
    <>
      <Link
        href={`/shipments?date=${shipment.planDate}`}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Shipments
      </Link>
      <PageHeader
        eyebrow="Shipment"
        title={shipment.shipmentNo}
        description={
          [shipment.shipToName, [shipment.city, shipment.province].filter(Boolean).join(" · ")]
            .filter(Boolean)
            .join(" — ") || undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader
            title="Progress"
            action={
              <div className="flex items-center gap-3 text-2xs">
                {toReview > 0 && (
                  <span className="text-[var(--st-amber)]">{toReview} to review</span>
                )}
                <span className={isComplete(shipment.events) ? "text-accent" : "text-muted"}>
                  {isComplete(shipment.events)
                    ? "Complete"
                    : current
                      ? STAGE_LABELS[current].en
                      : "Not started"}
                </span>
                <StageStrip events={shipment.events} />
              </div>
            }
          />
          <div className="p-4">
            <ShipmentTimeline
              shipmentId={shipment.id}
              events={shipment.events}
              canManage={isOrgWriter(user)}
            />
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title="From the plan" />
          <dl className="divide-y divide-line text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-2">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="min-w-0 truncate text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
