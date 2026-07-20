import { PageHeader } from "@/components/ui/page-header";
import { TripsTable } from "@/components/trips/trips-table";
import { getTrips } from "@/lib/mock/data";

export default function TripsPage() {
  const trips = getTrips();
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
