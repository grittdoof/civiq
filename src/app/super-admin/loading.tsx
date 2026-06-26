import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function SuperAdminLoading() {
  return (
    <main className="civiq-main" aria-busy="true">
      <SkeletonPageHeader />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="civiq-skel-card"
            style={{ padding: 16 }}
            aria-hidden
          >
            <Skeleton width="60%" height={11} style={{ marginBottom: 8 }} />
            <Skeleton width="45%" height={26} />
          </div>
        ))}
      </div>

      <SkeletonTable rows={8} columns={5} />
    </main>
  );
}
