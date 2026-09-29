import Link from "next/link";
import type { ShipmentRow } from "@/lib/data/shipments";
import { STAGE_LABELS, currentStage } from "@/lib/shipments/stages";
import { Code, CodeChip } from "@/components/ui/code";
import { StageStrip } from "@/components/shipments/stage-strip";

const SECTION_LABEL = {
  loaded: "ขึ้นแล้วส่งเลย",
  pending: "ขึ้นค้างส่ง",
  none: "Other",
} as const;

function ddmm(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function ShipmentTable({ shipments }: { shipments: ShipmentRow[] }) {
  if (shipments.length === 0) {
    return (
      <div className="rounded-md border border-line px-4 py-10 text-center text-sm text-muted">
        No shipments match this filter.
      </div>
    );
  }

  const sections = (["loaded", "pending", "none"] as const)
    .map((key) => ({
      key,
      rows: shipments.filter((s) => (s.section ?? "none") === key),
    }))
    .filter((s) => s.rows.length > 0);

  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-line bg-panel text-left text-2xs font-medium uppercase tracking-wide text-faint">
            <th className="px-4 py-2 font-medium">Shipment</th>
            <th className="px-3 py-2 font-medium">Ship to</th>
            <th className="px-3 py-2 font-medium">Delivery</th>
            <th className="px-3 py-2 text-right font-medium">Pallets</th>
            <th className="px-3 py-2 font-medium">Truck · driver</th>
            <th className="px-4 py-2 font-medium">Progress</th>
          </tr>
        </thead>
        {sections.map(({ key, rows }) => (
          <tbody key={key} className="divide-y divide-line">
            <tr className="border-y border-line bg-panel-2">
              <td colSpan={6} className="px-4 py-1.5 font-thai text-xs font-medium text-ink-soft">
                {SECTION_LABEL[key]}
                <span className="ml-2 font-mono text-2xs tabular text-faint">{rows.length}</span>
              </td>
            </tr>
            {rows.map((s) => {
              const current = currentStage(s.events);
              const toReview = s.events.filter((e) => e.status === "suggested").length;
              return (
                <tr key={s.id} className="align-top hover:bg-panel">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/shipments/${s.shipmentNo}`}
                      className="font-mono text-[0.9em] font-medium tabular tracking-tight text-accent hover:text-accent-ink hover:underline"
                    >
                      {s.shipmentNo}
                    </Link>
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5">
                    <div className="truncate font-thai text-ink" title={s.shipToName ?? undefined}>
                      {s.shipToName ?? "—"}
                    </div>
                    <div className="truncate font-thai text-2xs text-faint">
                      {[s.city, s.province].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Code>
                      {ddmm(s.deliveryDate)}
                      {s.deliveryDateEnd && s.deliveryDateEnd !== s.deliveryDate
                        ? `–${ddmm(s.deliveryDateEnd)}`
                        : ""}
                    </Code>
                    {s.timeWindow && (
                      <div>
                        <Code muted className="text-2xs">
                          {s.timeWindow}
                        </Code>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Code muted>{s.pallets ?? "—"}</Code>
                  </td>
                  <td className="px-3 py-2.5">
                    {s.plate ? <CodeChip>{s.plate}</CodeChip> : <span className="text-faint">—</span>}
                    {s.driverName && (
                      <div className="mt-1 font-thai text-2xs text-ink-soft">{s.driverName}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StageStrip events={s.events} />
                    <div className="mt-1 flex items-center gap-2 text-2xs">
                      <span className={current ? "text-ink-soft" : "text-faint"}>
                        {current ? STAGE_LABELS[current].en : "Not started"}
                      </span>
                      {toReview > 0 && (
                        <span className="text-[var(--st-amber)]">· {toReview} to review</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
