import { SkeletonPageHeader, SkeletonCard } from "@/components/ui/Skeleton";

// Fallback admin générique — applique à toutes les routes /admin/*
// qui n'ont pas leur propre loading.tsx. Affiché instantanément
// après le clic, le serveur peut prendre 1-2 s sans figer l'UI.

export default function AdminLoading() {
  return (
    <main className="civiq-main" aria-busy="true">
      <SkeletonPageHeader />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}
