import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <main className="civiq-main" aria-busy="true">
      <div style={{ marginBottom: 24 }}>
        <Skeleton width={280} height={28} style={{ marginBottom: 8 }} />
        <Skeleton width={420} height={14} />
      </div>

      {/* KPI tiles */}
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
            <Skeleton width="55%" height={11} style={{ marginBottom: 8 }} />
            <Skeleton width="40%" height={26} />
          </div>
        ))}
      </div>

      {/* Module cards */}
      <Skeleton width={140} height={16} style={{ marginBottom: 12 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} height={170} />
        ))}
      </div>
    </main>
  );
}
