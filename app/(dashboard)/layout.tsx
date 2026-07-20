import { Shell } from "@/components/shell/shell";
import { getReviewItems } from "@/lib/mock/data";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reviewCount = getReviewItems().filter(
    (r) => r.priority === "high" || r.priority === "medium",
  ).length;
  return <Shell reviewCount={reviewCount}>{children}</Shell>;
}
