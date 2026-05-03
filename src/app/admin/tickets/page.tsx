import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Map as MapIcon, BarChart3 } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { listTickets, getPhotoSignedUrl } from "@/lib/tickets/queries";
import { isModuleActive } from "@/lib/module-guard";
import TicketCard from "@/components/tickets/TicketCard";
import TicketsFilters, { type TicketsFilterValue } from "./TicketsFilters";
import TicketsRealtime from "@/components/tickets/TicketsRealtime";
import PushSubscriptionPrompt from "@/components/tickets/PushSubscriptionPrompt";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets — Liste des tickets de la commune
//
// Server Component : requireCommune() + listTickets() côté serveur,
// puis le composant client TicketsFilters gère pills/recherche/refresh.
// Les URLs signées des photos sont aussi générées côté serveur.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ filter?: string; search?: string }>;
}

export default async function TicketsListPage({ searchParams }: Props) {
  const ctx = await requireCommune();

  // Module gating
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("tickets");
    if (!active) {
      redirect("/admin/dashboard?module=tickets&state=inactive");
    }
  }
  if (!ctx.communeId) {
    redirect("/admin/onboarding");
  }

  const { filter = "tous", search = "" } = await searchParams;

  // Mapping filter → critères queries
  const filters: Parameters<typeof listTickets>[1] = { search };
  if (filter === "nouveau") filters.statut = ["nouveau", "assigne"];
  else if (filter === "en_cours") filters.statut = ["pris_en_charge", "en_cours", "en_attente"];
  else if (filter === "urgents") filters.priorite = "urgente";
  else if (filter === "mes_tickets") filters.assignedToMe = ctx.userId;
  else if (filter === "clos") filters.statut = ["resolu", "clos", "annule"];

  const tickets = await listTickets(ctx.communeId, filters);

  // Compteurs pour les pills (sans filtre)
  const allTickets = await listTickets(ctx.communeId, {});
  const counts = {
    tous: allTickets.length,
    nouveau: allTickets.filter((t) => ["nouveau", "assigne"].includes(t.statut)).length,
    en_cours: allTickets.filter((t) => ["pris_en_charge", "en_cours", "en_attente"].includes(t.statut)).length,
    urgents: allTickets.filter((t) => t.priorite === "urgente" && !["clos", "annule"].includes(t.statut)).length,
    mes_tickets: allTickets.filter((t) => t.assigne_a === ctx.userId).length,
    clos: allTickets.filter((t) => ["resolu", "clos", "annule"].includes(t.statut)).length,
  };

  // Pré-générer les URLs signées des premières photos
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
    })
  );

  const canCreate = ctx.role === "admin" || ctx.role === "super_admin" || ctx.role === "editor";

  return (
    <main className="civiq-main">
      <div className="tk-page-header">
        <div>
          <h1 className="civiq-page-title">Tickets d&apos;intervention</h1>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 3 }}>
            Signalements et interventions techniques de la commune.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/tickets/carte" className="civiq-btn civiq-btn-outline">
            <MapIcon size={14} /> Vue carte
          </Link>
          <Link href="/admin/tickets/stats" className="civiq-btn civiq-btn-outline">
            <BarChart3 size={14} /> Statistiques
          </Link>
          {canCreate && (
            <Link href="/admin/tickets/nouveau" className="civiq-btn civiq-btn-default">
              <Plus size={14} /> Nouveau ticket
            </Link>
          )}
        </div>
      </div>

      <TicketsFilters
        currentFilter={filter as TicketsFilterValue}
        currentSearch={search}
        counts={counts}
      />

      {tickets.length === 0 ? (
        <div className="civiq-card tk-empty">
          <p style={{ fontSize: 14, marginBottom: 4, color: "var(--fg)" }}>Aucun ticket pour ce filtre.</p>
          {canCreate && (
            <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>
              <Link href="/admin/tickets/nouveau" style={{ color: "var(--accent)" }}>Créez le premier ticket</Link> pour démarrer.
            </p>
          )}
        </div>
      ) : (
        <div className="tk-list">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} signedPhotoUrl={photoUrls.get(t.id)} />
          ))}
        </div>
      )}

      <TicketsRealtime communeId={ctx.communeId} />
      <PushSubscriptionPrompt />
    </main>
  );
}
