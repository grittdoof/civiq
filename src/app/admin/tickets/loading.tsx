import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function TicketsLoading() {
  return (
    <main className="civiq-main" aria-busy="true">
      <SkeletonPageHeader />

      {/* Pills filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={90 + i * 10} height={30} radius={99} />
        ))}
      </div>

      <SkeletonTable rows={8} columns={5} />
    </main>
  );
}
