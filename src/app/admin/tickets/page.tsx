import { redirect } from "next/navigation";
import Link from "next/link";
import { requireCommune } from "@/lib/auth-helpers";
import { listTickets, getPhotoSignedUrl } from "@/lib/tickets/queries";
import { isModuleActive } from "@/lib/module-guard";
import TicketCard from "@/components/tickets/TicketCard";
import TicketsFilters, { type TicketsFilterValue } from "./TicketsFilters";
import TicketsRealtime from "@/components/tickets/TicketsRealtime";
import { TKAvatar, TKFab } from "@/components/tickets/ui/tk-primitives";
import { TK } from "@/lib/tickets/design-tokens";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets — Liste (refonte phase 2 : direction Airbnb).
// Hero title, search pill, filtres pills, cards photo-héros, FAB.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ filter?: string; search?: string }>;
}

export default async function TicketsListPage({ searchParams }: Props) {
  const ctx = await requireCommune();

  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("tickets");
    if (!active) redirect("/admin/dashboard?module=tickets&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const { filter = "ouverts", search = "" } = await searchParams;

  const filters: Parameters<typeof listTickets>[1] = { search };
  if (filter === "ouverts")
    filters.statut = ["nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente"];
  else if (filter === "urgents") {
    filters.statut = ["nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente"];
    filters.priorite = "urgente";
  } else if (filter === "termines") filters.statut = ["resolu", "clos", "annule"];
  else if (filter === "mes") filters.assignedToMe = ctx.userId;

  const tickets = await listTickets(ctx.communeId, filters);

  // Compteurs pour les pills
  const allTickets = await listTickets(ctx.communeId, {});
  const myTickets = await listTickets(ctx.communeId, {
    assignedToMe: ctx.userId,
  });
  const ouverts = allTickets.filter((t) =>
    ["nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente"].includes(t.statut),
  );
  const counts = {
    mes: myTickets.length,
    ouverts: ouverts.length,
    urgents: ouverts.filter((t) => t.priorite === "urgente").length,
    termines: allTickets.filter((t) =>
      ["resolu", "clos", "annule"].includes(t.statut),
    ).length,
    tous: allTickets.length,
  };

  // URLs signées des premières photos
  const photoUrls = new Map<string, string>();
  await Promise.all(
    tickets.flatMap((t) => {
      const first = t.signalement_photos?.[0];
      if (!first) return [];
      return [
        getPhotoSignedUrl(first.storage_path).then((url) => {
          if (url) photoUrls.set(t.id, url);
        }),
      ];
    }),
  );

  const canCreate =
    ctx.role === "admin" || ctx.role === "super_admin" || ctx.role === "editor";

  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });

  return (
    <main
      className="relative flex min-h-[100dvh] flex-col bg-white"
      style={{ paddingBottom: "120px" }}
    >
      {/* HERO TITLE */}
      <div className="px-[22px] pb-3.5 pt-2">
        <div className="mb-2 flex items-center justify-between">
          <span
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: TK.muted, letterSpacing: "0.12em" }}
          >
            Tickets · {todayLabel}
          </span>
          <Link href="/admin/profile">
            <TKAvatar name={ctx.email ?? "?"} seed={ctx.userId} size={32} />
          </Link>
        </div>
        <h1
          className="m-0 font-bold leading-[1.1]"
          style={{
            color: TK.ink,
            fontSize: 30,
            letterSpacing: "-0.025em",
          }}
        >
          Tickets
        </h1>
      </div>

      <TicketsFilters
        currentFilter={filter as TicketsFilterValue}
        currentSearch={search}
        counts={counts}
      />

      {/* CARDS */}
      <div className="flex-1 overflow-y-auto px-[22px]">
        {tickets.length === 0 ? (
          <div
            className="py-16 text-center"
            style={{ color: TK.muted }}
          >
            <div className="mb-2 text-[42px]">🎉</div>
            <div
              className="text-sm font-semibold"
              style={{ color: TK.ink }}
            >
              Tout est à jour
            </div>
            <div className="mt-1 text-[12px]">
              Aucun ticket dans ce filtre.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {tickets.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                signedPhotoUrl={photoUrls.get(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {canCreate && (
        <Link href="/admin/tickets/nouveau">
          <TKFab>Nouveau ticket</TKFab>
        </Link>
      )}

      <TicketsRealtime communeId={ctx.communeId} />
    </main>
  );
}
