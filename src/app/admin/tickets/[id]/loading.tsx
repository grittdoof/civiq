import { Skeleton } from "@/components/ui/Skeleton";

export default function TicketDetailLoading() {
  return (
    <main className="civiq-main" aria-busy="true">
      <Skeleton width={160} height={28} radius={8} style={{ marginBottom: 16 }} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <Skeleton width={120} height={11} style={{ marginBottom: 10 }} />
          <Skeleton width="80%" height={28} style={{ marginBottom: 10 }} />
          <Skeleton width="50%" height={14} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton width={120} height={36} radius={8} />
          <Skeleton width={120} height={36} radius={8} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 16,
        }}
      >
        <div className="civiq-skel-card" style={{ padding: 18 }} aria-hidden>
          <Skeleton width={160} height={16} style={{ marginBottom: 14 }} />
          <Skeleton width="100%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="92%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="78%" height={14} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={240} radius={10} />
        </div>
        <div className="civiq-skel-card" style={{ padding: 18 }} aria-hidden>
          <Skeleton width={120} height={16} style={{ marginBottom: 14 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <Skeleton width={90} height={11} style={{ marginBottom: 6 }} />
              <Skeleton width="80%" height={14} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
