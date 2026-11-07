import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Map as MapIcon, BarChart3, Printer, Settings, Search } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { listTickets } from "@/lib/tickets/queries";
import { droitsSurTicket, fonctionDe, peutCreer, valeurAction } from "@/lib/tickets/droits";
import { listerCategories } from "@/lib/tickets/categories-server";
import { URGENCE_LABELS, cheminCategorie, etatDelai, type Urgence } from "@/lib/tickets/categories";
import {
  actionRapide, estAMoi, estOuvert, filtrerVue, grouperParUrgence, libelleVue,
  vueParDefaut, vuesDisponibles, type Vue,
} from "@/lib/tickets/interventions";
import { createServiceClient } from "@/lib/supabase-server";
import { chargerSpectateur, versDroits } from "@/lib/tickets/droits-server";
import { urlPhoto } from "@/lib/tickets/pieces";
import { STATUT_LABELS, type TicketWithRelations } from "@/lib/tickets/types";
import { isModuleActive } from "@/lib/module-guard";
import TicketsRealtime from "@/components/tickets/TicketsRealtime";
import LigneIntervention, { type DonneesLigne } from "@/components/tickets/LigneIntervention";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets — « Interventions » (lot 3, maquette 1A)
//
// Onglets selon le profil et la matrice de la commune (À moi, Mon
// service / Ma délégation, Non assignés, Mes demandes, Tous) ;
// tickets ouverts regroupés par urgence (danger → faible), triés par
// délai cible puis ancienneté ; une action rapide par ligne.
// Paramètres : ?vue=…&etat=ouverts|clotures&q=…
// (anciens liens ?filter=mes|ouverts|cloture|tous acceptés).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ vue?: string; etat?: string; q?: string; filter?: string; search?: string }>;
}

function ilYa(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return minutes <= 1 ? "à l'instant" : `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 7) return `il y a ${jours} j`;
  const semaines = Math.floor(jours / 7);
  if (semaines < 5) return `il y a ${semaines} sem.`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const SECTION_TON: Record<Urgence, string> = {
  danger_immediat: "#B0000F", urgente: "#8A4B00", normale: "var(--fg-muted)", faible: "var(--fg-muted)",
};

export default async function TicketsListPage({ searchParams }: Props) {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId && !(await isModuleActive("tickets"))) {
    redirect("/admin/dashboard?module=tickets&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const sp = await searchParams;
  const service = await createServiceClient();
  const spectateur = await chargerSpectateur();
  const [{ data: profil }, tickets, categories] = await Promise.all([
    service.from("profiles").select("job_title").eq("id", ctx.userId).maybeSingle(),
    listTickets(ctx.communeId, {}, spectateur),
    listerCategories(service, ctx.communeId),
  ]);
  const fonction = fonctionDe(profil?.job_title ?? null);
  const services = spectateur?.services ?? new Set<string>();

  // Onglets disponibles et onglet courant (anciens paramètres compris)
  const vues = vuesDisponibles({ role: ctx.role, ligne: spectateur?.ligne ?? null, aDesServices: services.size > 0 });
  const vueDemandee = (sp.vue ?? (sp.filter === "mes" ? "moi" : sp.filter === "tous" ? "tous" : undefined)) as Vue | undefined;
  const vue: Vue = vueDemandee && vues.includes(vueDemandee) ? vueDemandee : vueParDefaut(fonction, vues);
  const etat = sp.etat === "clotures" || sp.filter === "cloture" ? "clotures" : "ouverts";
  const q = (sp.q ?? sp.search ?? "").trim();

  const parVue = (v: Vue) => filtrerVue(tickets, v, ctx.userId, services);
  const comptes = Object.fromEntries(vues.map((v) => [v, parVue(v).filter((t) => estOuvert(t.statut)).length])) as Record<Vue, number>;

  const recherche = (t: TicketWithRelations) => {
    if (!q) return true;
    const n = Number(q.replace(/^#/, ""));
    if (Number.isFinite(n) && n > 0 && t.numero === n) return true;
    const s = q.toLowerCase();
    return t.titre.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s) || (t.adresse ?? "").toLowerCase().includes(s);
  };
  const dansVue = parVue(vue).filter(recherche);
  const ouverts = dansVue.filter((t) => estOuvert(t.statut));
  const clotures = dansVue
    .filter((t) => !estOuvert(t.statut))
    .sort((a, b) => (b.clos_at ?? b.updated_at).localeCompare(a.clos_at ?? a.updated_at));

  // Données des lignes (droits calculés ici, pour l'action rapide)
  const versLigne = (t: TicketWithRelations): DonneesLigne => {
    const droits = spectateur
      ? droitsSurTicket(versDroits(t, { assignes: t.assignee_ids ?? [], destinataires: t.destinataire_ids ?? [] }), spectateur)
      : null;
    const ch = cheminCategorie(t.categorie_id, categories);
    const ouvert = estOuvert(t.statut);
    const delai = etatDelai(t.delai_cible_le, t.created_at, ouvert);
    const puces: DonneesLigne["puces"] = [];
    const urgence = (t.urgence ?? "normale") as Urgence;
    if (ouvert && urgence === "danger_immediat" && (t.statut === "nouveau" || t.statut === "assigne") && !t.pris_en_charge_at) {
      puces.push({ texte: `Non pris en charge · ${ilYa(t.created_at).replace("il y a ", "")}`, ton: "danger" });
    } else {
      puces.push({
        texte: STATUT_LABELS[t.statut],
        ton: !ouvert ? "neutre" : t.statut === "nouveau" ? "info" : t.statut === "en_attente" ? "alerte" : "ok",
      });
    }
    if (delai === "depasse") puces.push({ texte: "Délai dépassé", ton: "danger" });
    else if (delai === "proche") puces.push({ texte: "Délai proche", ton: "alerte" });
    if (t.transmis_a) puces.push({ texte: `Transmis : ${t.transmis_a}`, ton: "neutre" });
    if (estAMoi(t, ctx.userId) && vue !== "moi") puces.push({ texte: "À moi", ton: "info" });
    const premiere = t.signalement_photos?.[0];
    return {
      id: t.id, numero: t.numero, titre: t.titre,
      lieu: t.adresse ? t.adresse.replace(/,\s*[^,]*$/, "") : null,
      categorie: ch.sous?.libelle ?? ch.racine?.libelle ?? null,
      age: ilYa(t.created_at),
      urgence, puces,
      confidentialite: t.confidentialite ?? "standard",
      miniature: premiere ? urlPhoto(t.id, premiere.id, { miniature: true }) : null,
      action: droits ? actionRapide(t, droits, ctx.userId) : null,
    };
  };

  const canCreate = !!spectateur && peutCreer(spectateur);
  const canExport = !!spectateur && valeurAction("exporter", spectateur) === "oui";
  const canConfigure = ctx.role === "admin" || ctx.role === "super_admin";
  const lien = (o: { vue?: Vue; etat?: string }) => {
    const p = new URLSearchParams();
    p.set("vue", o.vue ?? vue);
    if ((o.etat ?? etat) === "clotures") p.set("etat", "clotures");
    if (q) p.set("q", q);
    return `/admin/tickets?${p.toString()}`;
  };
  const sousTitre = vue === "moi" ? "Les tickets qui vous sont assignés"
    : vue === "service" ? "Les tickets de vos services"
    : vue === "non_assignes" ? "Les tickets à attribuer"
    : vue === "demandes" ? "Les tickets que vous avez créés"
    : "Tous les tickets que vous pouvez voir";

  return (
    <main className="civiq-main tk-list-page">
      <div className="tk-page-header">
        <div>
          <h1 className="civiq-page-title">Interventions</h1>
          <p className="tk-page-subtitle">{sousTitre} · triés par urgence puis délai</p>
        </div>
        <div className="tk-page-header-actions">
          <Link href="/admin/tickets/carte" className="civiq-btn civiq-btn-outline tk-page-header-link">
            <MapIcon size={14} /> <span>Carte</span>
          </Link>
          <Link href="/admin/tickets/stats" className="civiq-btn civiq-btn-outline tk-page-header-link">
            <BarChart3 size={14} /> <span>Statistiques</span>
          </Link>
          {canExport && (
            <Link href={`/tickets-pdf${etat === "clotures" ? "?filter=cloture" : ""}`} className="civiq-btn civiq-btn-outline tk-page-header-link" target="_blank" rel="noreferrer" prefetch={false}>
              <Printer size={14} /> <span>Imprimer / PDF</span>
            </Link>
          )}
          {canConfigure && (
            <Link href="/admin/tickets/parametres" className="civiq-btn civiq-btn-outline tk-page-header-link" aria-label="Paramètres des tickets">
              <Settings size={14} /> <span>Paramètres</span>
            </Link>
          )}
          {canCreate && (
            <Link href="/admin/tickets/nouveau" className="civiq-btn civiq-btn-default tk-page-header-create">
              <Plus size={14} /> Nouveau ticket
            </Link>
          )}
        </div>
      </div>

      {vues.length > 1 && (
        <nav aria-label="Vues" className="tk-vues">
          {vues.map((v) => (
            <Link key={v} href={lien({ vue: v })} className="tk-vue" aria-current={v === vue ? "page" : undefined}>
              {libelleVue(v, fonction)} <span className="tk-vue-compte">{comptes[v]}</span>
            </Link>
          ))}
        </nav>
      )}

      <div className="tk-outils">
        <div role="group" aria-label="État" className="tk-etat">
          <Link href={lien({ etat: "ouverts" })} aria-current={etat === "ouverts" ? "page" : undefined}>Ouverts · {ouverts.length}</Link>
          <Link href={lien({ etat: "clotures" })} aria-current={etat === "clotures" ? "page" : undefined}>Clôturés · {clotures.length}</Link>
        </div>
        <form action="/admin/tickets" method="get" className="tk-recherche" role="search">
          <input type="hidden" name="vue" value={vue} />
          {etat === "clotures" && <input type="hidden" name="etat" value="clotures" />}
          <Search size={15} aria-hidden="true" />
          <label className="tk-sr-only" htmlFor="tk-q">Rechercher un ticket</label>
          <input id="tk-q" name="q" defaultValue={q} placeholder="Titre, adresse ou n°…" />
        </form>
      </div>

      {etat === "ouverts" ? (
        ouverts.length === 0 ? (
          <div className="civiq-card tk-empty">
            <p className="tk-empty-title">{q ? "Aucun ticket ne correspond" : vue === "moi" ? "Aucune intervention en cours" : "Aucun ticket ouvert"}</p>
            <p className="tk-empty-hint">{q ? "Essayez un autre mot ou un numéro." : vue === "moi" ? "Vous êtes à jour." : "Tous les tickets de cette vue sont clôturés."}</p>
          </div>
        ) : (
          grouperParUrgence(ouverts).map((g) => (
            <section key={g.urgence} aria-labelledby={`sec-${g.urgence}`} className="tk-section">
              <h2 id={`sec-${g.urgence}`} className="tk-section-titre" style={{ color: SECTION_TON[g.urgence] }}>
                {URGENCE_LABELS[g.urgence]} · {g.tickets.length}
              </h2>
              <ul className="tk-lignes">
                {g.tickets.map((t) => <LigneIntervention key={t.id} t={versLigne(t)} communeId={ctx.communeId!} />)}
              </ul>
            </section>
          ))
        )
      ) : clotures.length === 0 ? (
        <div className="civiq-card tk-empty"><p className="tk-empty-title">Aucun ticket clôturé dans cette vue</p></div>
      ) : (
        <ul className="tk-lignes">
          {clotures.slice(0, 200).map((t) => <LigneIntervention key={t.id} t={versLigne(t)} communeId={ctx.communeId!} />)}
        </ul>
      )}

      {canCreate && (
        <Link href="/admin/tickets/nouveau" className="tk-fab" aria-label="Nouveau ticket">
          <Plus size={20} strokeWidth={2.5} />
          <span>Nouveau ticket</span>
        </Link>
      )}

      <TicketsRealtime communeId={ctx.communeId} />
    </main>
  );
}
