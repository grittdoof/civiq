import { Skeleton, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function PpiLoading() {
  return (
    <main className="civiq-main pj-projects-page" aria-busy="true">
      <SkeletonPageHeader />

      {/* Bandeau totaux */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="civiq-skel-card"
            style={{ padding: 14 }}
            aria-hidden
          >
            <Skeleton width="65%" height={11} style={{ marginBottom: 8 }} />
            <Skeleton width="55%" height={22} />
          </div>
        ))}
      </section>

      {/* Note méthodologique */}
      <Skeleton
        width="100%"
        height={42}
        radius={8}
        style={{ marginBottom: 18 }}
      />

      {/* Sections par année */}
      {Array.from({ length: 2 }).map((_, year) => (
        <section
          key={year}
          className="civiq-skel-card"
          style={{ padding: 0, marginBottom: 18, overflow: "hidden" }}
          aria-hidden
        >
          {/* Header année */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 20px 10px",
              borderBottom: "1px solid var(--border, #e8e5de)",
            }}
          >
            <Skeleton width={200} height={18} />
            <div style={{ display: "flex", gap: 20 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} width={90} height={28} />
              ))}
            </div>
          </div>

          {/* Lignes du tableau */}
          {Array.from({ length: 4 }).map((_, r) => (
            <div
              key={r}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                gap: 16,
                alignItems: "center",
                padding: "12px 20px",
                borderBottom: "1px solid var(--border-light, #f5f3ed)",
              }}
            >
              <Skeleton width="80%" height={14} />
              <Skeleton width="60%" height={14} />
              <Skeleton width="50%" height={14} />
              <Skeleton width="70%" height={14} />
              <Skeleton width="70%" height={14} />
              <Skeleton width="70%" height={14} />
              <Skeleton width="70%" height={14} />
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
