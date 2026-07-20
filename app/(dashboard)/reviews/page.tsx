import { PageHeader } from "@/components/ui/page-header";
import { ReviewQueue } from "@/components/reviews/review-queue";
import { getReviewItems } from "@/lib/mock/data";

export default function ReviewsPage() {
  const items = getReviewItems();
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
