import { PageHeader } from "@/components/ui/page-header";
import { TripsTable } from "@/components/trips/trips-table";
import { listTrips } from "@/lib/data/trips";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const trips = await listTrips();
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Trips"
        description="Every consolidated trip. One shipment code, one row — updates append to its timeline."
      />
      <TripsTable trips={trips} />
    </>
  );
}
