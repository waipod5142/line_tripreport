import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PlanUpload } from "@/components/shipments/plan-upload";
import { ShipmentFilterBar } from "@/components/shipments/shipment-filter-bar";
import { ShipmentTable } from "@/components/shipments/shipment-table";
import { getCurrentUser, isOrgWriter } from "@/lib/data/session";
import { listPlanDates, listShipments } from "@/lib/data/shipments";
import { matchesStage, parseShipmentFilters, shipmentFiltersToQuery } from "@/lib/shipments/filters";
import { currentStage, isComplete } from "@/lib/shipments/stages";

// Stage suggestions land continuously from the LINE webhook.
export const dynamic = "force-dynamic";

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseShipmentFilters(await searchParams);
  const [user, planDates] = await Promise.all([getCurrentUser(), listPlanDates()]);
  const canImport = isOrgWriter(user);

  // A date with no plan (typo'd URL, deleted rows) falls back to the latest.
  if (filters.date && !planDates.includes(filters.date)) {
    const q = shipmentFiltersToQuery({ ...filters, date: null });
    redirect(q ? `/shipments?${q}` : "/shipments");
  }
  const planDate = filters.date ?? planDates[0] ?? null;

  const header = (
    <PageHeader
      eyebrow="Tracking"
      title="Shipments"
      description="Each shipment from the customer's daily plan, tracked through six stages — from picking at the warehouse to pallets returned — using what drivers report in LINE."
    />
  );

  if (!planDate) {
    return (
      <>
        {header}
        {canImport ? (
          <PlanUpload />
        ) : (
          <div className="rounded-md border border-line bg-panel px-4 py-16 text-center">
            <p className="text-sm font-medium text-ink">No plan imported yet</p>
            <p className="mt-1 text-xs text-muted">
              A dispatcher imports the customer’s daily plan here.
            </p>
          </div>
        )}
      </>
    );
  }

  const all = await listShipments(planDate);
  const shown = all.filter((s) => matchesStage(currentStage(s.events), filters.stage));
  const complete = all.filter((s) => isComplete(s.events)).length;
  const toReview = all.reduce(
    (n, s) => n + s.events.filter((e) => e.status === "suggested").length,
    0,
  );

  return (
    <>
      {header}
      {canImport && (
        <div className="mb-6">
          <PlanUpload />
        </div>
      )}
      <ShipmentFilterBar filters={filters} planDate={planDate} planDates={planDates} />
      <div className="mb-2 flex flex-wrap items-center gap-x-3 text-xs text-muted">
        <span>
          <span className="font-medium tabular text-ink-soft">{shown.length}</span>
          {shown.length !== all.length && (
            <>
              {" "}of <span className="tabular">{all.length}</span>
            </>
          )}{" "}
          shipments
        </span>
        <span>
          <span className="tabular">{complete}</span> complete
        </span>
        {toReview > 0 && (
          <span className="text-[var(--st-amber)]">
            <span className="tabular">{toReview}</span> suggestions to review
          </span>
        )}
      </div>
      <ShipmentTable shipments={shown} />
    </>
  );
}
