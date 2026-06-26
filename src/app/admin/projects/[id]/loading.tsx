import { Skeleton } from "@/components/ui/Skeleton";

export default function ProjectDetailLoading() {
  return (
    <main className="civiq-main" aria-busy="true">
      {/* Bandeau retour */}
      <Skeleton width={140} height={28} radius={8} style={{ marginBottom: 16 }} />

      {/* Header projet : titre + actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <Skeleton width="70%" height={32} style={{ marginBottom: 10 }} />
          <Skeleton width="50%" height={14} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton width={110} height={38} radius={8} />
          <Skeleton width={140} height={38} radius={8} />
        </div>
      </div>

      {/* Photo de couverture */}
      <Skeleton width="100%" height={240} radius={12} style={{ marginBottom: 24 }} />

      {/* Stepper de phases */}
      <div
        className="civiq-skel-card"
        style={{ padding: 16, marginBottom: 24 }}
        aria-hidden
      >
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} width={48} height={48} radius={24} />
          ))}
        </div>
      </div>

      {/* Sections principales */}
      {Array.from({ length: 3 }).map((_, s) => (
        <section
          key={s}
          className="civiq-skel-card"
          style={{ padding: 18, marginBottom: 16 }}
          aria-hidden
        >
          <Skeleton width={180} height={16} style={{ marginBottom: 14 }} />
          <Skeleton width="100%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="92%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="78%" height={14} />
        </section>
      ))}
    </main>
  );
}
