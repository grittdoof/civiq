import { Skeleton, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function ProjectsLoading() {
  return (
    <main className="civiq-main pj-projects-page" aria-busy="true">
      <SkeletonPageHeader />

      {/* Bandeau de KPIs */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="civiq-skel-card"
            style={{ padding: 12 }}
            aria-hidden
          >
            <Skeleton width="65%" height={11} style={{ marginBottom: 8 }} />
            <Skeleton width="50%" height={20} />
          </div>
        ))}
      </section>

      {/* Lanes par phase — chaque lane a un header + 2-3 cards skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {Array.from({ length: 4 }).map((_, lane) => (
          <section
            key={lane}
            className="civiq-skel-card"
            style={{ padding: 14 }}
            aria-hidden
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <Skeleton width={36} height={36} radius={10} />
              <div style={{ flex: 1 }}>
                <Skeleton width={160} height={15} style={{ marginBottom: 6 }} />
                <Skeleton width={220} height={11} />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 10,
              }}
            >
              {Array.from({ length: 3 }).map((_, c) => (
                <Skeleton key={c} height={86} radius={10} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
