import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function SurveysLoading() {
  return (
    <main className="civiq-main" aria-busy="true">
      <SkeletonPageHeader />
      <SkeletonTable rows={6} columns={5} />
    </main>
  );
}
