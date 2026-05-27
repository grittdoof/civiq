import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Map as MapIcon, BarChart3, Printer } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { listTickets, getPhotoSignedUrl } from "@/lib/tickets/queries";
import { OUVERT_STATUTS, CLOTURE_STATUTS } from "@/lib/tickets/types";
import { isModuleActive } from "@/lib/module-guard";
import TicketCard from "@/components/tickets/TicketCard";
import TicketsFilters, { type TicketsFilterValue } from "./TicketsFilters";
import TicketsRealtime from "@/components/tickets/TicketsRealtime";

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

  // Filtre par défaut = "ouverts" (tickets pas encore pris en charge)
  const { filter = "ouverts", search = "" } = await searchParams;

  // Mapping filter → critères queries (cycle simplifié : Ouvert / Clôturé)
  const filters: Parameters<typeof listTickets>[1] = { search };
  if (filter === "ouverts") filters.statut = OUVERT_STATUTS;
  else if (filter === "cloture") filters.statut = CLOTURE_STATUTS;
  else if (filter === "mes") filters.assignedToMe = ctx.userId;

  const tickets = await listTickets(ctx.communeId, filters);

  // Compteurs pour les pills — on calcule "Mes tickets" avec la même logique
  // que la query (assigne_a OU multi-assignés via ticket_assignees).
  const allTickets = await listTickets(ctx.communeId, {});
  const myTickets = await listTickets(ctx.communeId, { assignedToMe: ctx.userId });
  const counts = {
    mes: myTickets.length,
    ouverts: allTickets.filter((t) => (OUVERT_STATUTS as string[]).includes(t.statut)).length,
    cloture: allTickets.filter((t) => (CLOTURE_STATUTS as string[]).includes(t.statut)).length,
    tous: allTickets.length,
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

  const emptyState = emptyStateFor(filter, canCreate, counts.tous === 0);

  return (
    <main className="civiq-main tk-list-page">
      <div className="tk-page-header">
        <div>
          <h1 className="civiq-page-title">Tickets d&apos;intervention</h1>
          <p className="tk-page-subtitle">
            Signalements et interventions techniques de la commune.
          </p>
        </div>
        <div className="tk-page-header-actions">
          <Link href="/admin/tickets/carte" className="civiq-btn civiq-btn-outline tk-page-header-link">
            <MapIcon size={14} /> <span>Vue carte</span>
          </Link>
          <Link href="/admin/tickets/stats" className="civiq-btn civiq-btn-outline tk-page-header-link">
            <BarChart3 size={14} /> <span>Statistiques</span>
          </Link>
          <Link
            href={`/api/tickets/pdf${filter !== "ouverts" ? `?filter=${filter}` : ""}`}
            className="civiq-btn civiq-btn-outline tk-page-header-link"
            target="_blank"
            rel="noreferrer"
          >
            <Printer size={14} /> <span>Imprimer / PDF</span>
          </Link>
          {canCreate && (
            <Link href="/admin/tickets/nouveau" className="civiq-btn civiq-btn-default tk-page-header-create">
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
          <div className="tk-empty-icon" aria-hidden>{emptyState.icon}</div>
          <p className="tk-empty-title">{emptyState.title}</p>
          {emptyState.hint && (
            <p className="tk-empty-hint">{emptyState.hint}</p>
          )}
          {emptyState.cta && (
            <Link href={emptyState.cta.href} className="civiq-btn civiq-btn-default tk-empty-cta">
              <Plus size={14} /> {emptyState.cta.label}
            </Link>
          )}
        </div>
      ) : (
        <div className="tk-list">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} signedPhotoUrl={photoUrls.get(t.id)} />
          ))}
        </div>
      )}

      {canCreate && (
        <Link
          href="/admin/tickets/nouveau"
          className="tk-fab"
          aria-label="Nouveau ticket"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span>Nouveau</span>
        </Link>
      )}

      <TicketsRealtime communeId={ctx.communeId} />
      {/* PushSubscriptionPrompt est désormais monté dans AdminShell */}
    </main>
  );
}

interface EmptyState {
  icon: string;
  title: string;
  hint?: string;
  cta?: { href: string; label: string };
}

function emptyStateFor(filter: string, canCreate: boolean, isFreshCommune: boolean): EmptyState {
  if (isFreshCommune) {
    return {
      icon: "🚀",
      title: "Aucun ticket pour l'instant",
      hint: "Lance le module en créant ton premier signalement.",
      cta: canCreate ? { href: "/admin/tickets/nouveau", label: "Créer un premier ticket" } : undefined,
    };
  }
  switch (filter) {
    case "mes":
      return { icon: "🙌", title: "Aucun ticket ne t'est assigné", hint: "Tu es à jour sur tes interventions." };
    case "ouverts":
      return { icon: "✨", title: "Aucun ticket ouvert", hint: "Tous les signalements ont été clôturés." };
    case "cloture":
      return { icon: "📭", title: "Aucun ticket clôturé", hint: "Les tickets clôturés apparaîtront ici." };
    default:
      return {
        icon: "📋",
        title: "Aucun ticket trouvé",
        hint: "Aucun résultat pour cette recherche ou ce filtre.",
        cta: canCreate ? { href: "/admin/tickets/nouveau", label: "Nouveau ticket" } : undefined,
      };
  }
}
