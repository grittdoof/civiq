import { Skeleton, SkeletonPageHeader, SkeletonCard } from "@/components/ui/Skeleton";

export default function CommissionsLoading() {
  return (
    <main className="civiq-main" aria-busy="true">
      <SkeletonPageHeader />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="civiq-skel-card"
            style={{ padding: 18 }}
            aria-hidden
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Skeleton width={36} height={36} radius={10} />
              <div style={{ flex: 1 }}>
                <Skeleton width="75%" height={15} style={{ marginBottom: 6 }} />
                <Skeleton width="50%" height={11} />
              </div>
            </div>
            <Skeleton width="100%" height={12} style={{ marginBottom: 6 }} />
            <Skeleton width="86%" height={12} />
          </div>
        ))}
      </div>
    </main>
  );
}
