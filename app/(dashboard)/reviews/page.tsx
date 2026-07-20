import { PageHeader } from "@/components/ui/page-header";
import { ReviewQueue } from "@/components/reviews/review-queue";
import { listReviewItems } from "@/lib/data/reviews";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const items = await listReviewItems();
  return (
    <>
      <PageHeader
        eyebrow="Human control"
        title="Review queue"
        description="AI proposes, you decide. Low-confidence or conflicting extractions land here before anything is written to a trip."
      />
      <ReviewQueue items={items} />
    </>
  );
}
