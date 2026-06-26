import { Skeleton, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <main className="civiq-main" aria-busy="true">
      <SkeletonPageHeader />

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <Skeleton width={220} height={36} radius={8} />
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton width={80} height={36} radius={8} />
          <Skeleton width={80} height={36} radius={8} />
        </div>
      </div>

      {/* Grille calendrier */}
      <div
        className="civiq-skel-card"
        style={{
          padding: 12,
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
        }}
        aria-hidden
      >
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} height={88} radius={6} />
        ))}
      </div>
    </main>
  );
}
