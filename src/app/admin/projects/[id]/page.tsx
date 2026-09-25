import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Layers, MapPin, Pencil, UserRound, Users } from "lucide-react";
import "../projects.css";
import "../flow.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getProject, listStakeholders } from "@/lib/projects/queries";
import {
  BUDGET_CATEGORIE_LABELS,
  FINANCING_STATUS_LABELS,
  type BudgetCategorie,
  type FinancingStatus,
  type TypeProjetCode,
} from "@/lib/projects/types";
import {
  avancementAffiche, formatEtapeDate, isEnRetard, joursAvant, libelleCompteARebours,
} from "@/lib/projects/etapes";
import { FOURCHETTES } from "@/lib/projects/wizard";
import { formatEuros } from "@/lib/projects/cost-calc";
import TypeBadge from "@/components/projects/TypeBadge";
import Gauge from "@/components/projects/GaugeLazy";
import EtapesEditor from "@/components/projects/EtapesEditor";
import PartiesPrenantesEditor from "@/components/projects/PartiesPrenantesEditor";
import DocumentsEditor from "@/components/projects/DocumentsEditor";
import QuotesComparator from "@/components/projects/QuotesComparator";
import ProjectPhotoUpload from "@/components/projects/ProjectPhotoUpload";
import ProjectTypeChanger from "@/components/projects/ProjectTypeChanger";
import AvancementAjuster from "@/components/projects/AvancementAjuster";
import SuiviActions from "@/components/projects/SuiviActions";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/[id] — écran de vie du projet (brief §2.3, lot B).
//
// Une seule vue principale (étapes, ou rétroplanning pour un
// événement) ; le reste en onglets secondaires selon le type. Bandeau
// compact : photo, titre, type, commission, élu référent, deux jauges.
//
// Transition : Budget / Financeurs seront reconstruits au lot C ; ils
// affichent ici les données existantes et renvoient vers l'ancienne vue
// détaillée (/phase/…) pour les modifier.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

type Onglet = "etapes" | "retroplanning" | "budget" | "devis" | "financeurs" | "partenaires" | "documents";

const ONGLETS: Record<TypeProjetCode, Array<{ key: Onglet; label: string }>> = {
  investissement: [
    { key: "etapes", label: "Étapes" },
    { key: "budget", label: "Budget" },
    { key: "devis", label: "Devis" },
    { key: "financeurs", label: "Financeurs" },
    { key: "documents", label: "Documents" },
  ],
  evenementiel: [
    { key: "retroplanning", label: "Rétroplanning" },
    { key: "budget", label: "Budget" },
    { key: "partenaires", label: "Partenaires" },
    { key: "documents", label: "Documents" },
  ],
  suivi_simple: [{ key: "etapes", label: "Étapes" }],
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}

export default async function ProjectLifePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { onglet } = await searchParams;
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const [detail, directory] = await Promise.all([getProject(ctx.communeId, id), listStakeholders(ctx.communeId)]);
  const p = detail.project;
  if (!p) notFound();

  const service = await createServiceClient();
  const { data: budgetLines } = await service
    .from("project_budget_lines")
    .select("id, sens, categorie, libelle, montant_prevu, montant_reel")
    .is("deleted_at", null)
    .eq("project_id", id)
    .order("created_at");

  const canEdit = ["admin", "editor", "super_admin"].includes(ctx.role ?? "");
  const type = (p.type_code ?? "suivi_simple") as TypeProjetCode;
  const blocsSupp = (p as { blocs_supplementaires?: string[] }).blocs_supplementaires ?? [];
  const tabs = [...ONGLETS[type]];
  if (type === "suivi_simple" && (blocsSupp.includes("devis"))) tabs.push({ key: "devis", label: "Devis" });
  const current: Onglet = tabs.some((t) => t.key === onglet) ? (onglet as Onglet) : tabs[0].key;

  const ext = p as typeof p & {
    commission_pilote_id?: string | null;
    fourchette_estimation?: string | null;
    echeance_souhaitee?: string | null;
    evenement_debut?: string | null;
    evenement_fin?: string | null;
    lieu?: string | null;
    jauge?: number | null;
  };
  const commission = detail.commissions.find((c) => c.id === ext.commission_pilote_id) ?? detail.commissions[0] ?? null;
  const avancement = avancementAffiche(p);
  const now = new Date();
  const retards = detail.milestones.filter((m) => isEnRetard(m, now)).length;
  const legacyHref = `/admin/projects/${id}/phase/${p.phase}`;
  const jours = ext.evenement_debut ? joursAvant(ext.evenement_debut, now) : null;
  const archived = !!p.archived_at;

  return (
    <main className="civiq-main pj-life">
      <div className="pj-detail-back">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} aria-hidden="true" /> Tous les projets
        </Link>
      </div>

      {archived && (
        <p className="pj-alerte pj-alerte-information" role="status">
          Ce projet est archivé{p.archive_motif ? ` : ${p.archive_motif}` : ""}. Il reste consultable.
        </p>
      )}

      {/* ─── Bandeau ─── */}
      <header className="civiq-card pj-life-head">
        <div className="pj-life-photo">
          <ProjectPhotoUpload projectId={id} current={p.photo_url} canEdit={canEdit && !archived} />
        </div>
        <div className="pj-life-id">
          <div className="pj-life-badges">
            <TypeBadge type={type} />
            {commission && (
              <span className="pj-commission-badge" style={{ ["--comm-color" as string]: commission.color }}>
                <span className="pj-wiz-dot" style={{ background: commission.color }} aria-hidden="true" />
                {commission.nom}
              </span>
            )}
            {retards > 0 && (
              <span className="civiq-badge civiq-badge-warning">{retards} étape{retards > 1 ? "s" : ""} en retard</span>
            )}
          </div>
          <h1 className="pj-life-title">{p.titre}</h1>
          <ul className="pj-life-facts">
            <li><UserRound size={14} aria-hidden="true" /> Élu référent : {p.pilote_elu_profile?.full_name ?? <em>à désigner</em>}</li>
            {p.pilote_agent_profile?.full_name && <li><Users size={14} aria-hidden="true" /> Agent pilote : {p.pilote_agent_profile.full_name}</li>}
            {detail.contributors.length > 0 && (
              <li><Users size={14} aria-hidden="true" /> Participants : {detail.contributors.map((c) => c.full_name ?? "Sans nom").join(", ")}</li>
            )}
            {type === "investissement" && ext.fourchette_estimation && (
              <li>Estimation : {FOURCHETTES.find((f) => f.code === ext.fourchette_estimation)?.label}</li>
            )}
            {type === "investissement" && (
              <li><CalendarDays size={14} aria-hidden="true" /> Échéance : {ext.echeance_souhaitee ? formatEtapeDate(`${ext.echeance_souhaitee}T00:00:00.000Z`) : "pas d'échéance définie"}</li>
            )}
            {type === "evenementiel" && ext.evenement_debut && (
              <li><CalendarDays size={14} aria-hidden="true" /> {formatEtapeDate(ext.evenement_debut)}{ext.evenement_fin ? ` → ${ext.evenement_fin.slice(11, 16)}` : ""}</li>
            )}
            {type === "evenementiel" && ext.lieu && <li><MapPin size={14} aria-hidden="true" /> {ext.lieu}{ext.jauge ? ` · ${ext.jauge} personnes attendues` : ""}</li>}
          </ul>
          {p.description && <p className="pj-life-desc">{p.description}</p>}
          <div className="pj-life-actions">
            {canEdit && !archived && (
              <Link href={`/admin/projects/${id}/edit`} className="civiq-btn civiq-btn-outline civiq-btn-sm">
                <Pencil size={14} aria-hidden="true" /> Modifier
              </Link>
            )}
            {canEdit && !archived && <ProjectTypeChanger projectId={id} currentType={type} canEdit />}
            <Link href={legacyHref} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
              <Layers size={14} aria-hidden="true" /> Vue détaillée (ancienne)
            </Link>
          </div>
        </div>

        <div className="pj-life-gauges">
          {type === "evenementiel" && jours !== null ? (
            <div className="pj-countdown" role="timer" aria-live="off">
              <span className="pj-countdown-value">{libelleCompteARebours(jours)}</span>
              <span className="pj-countdown-label">avant l&apos;événement</span>
            </div>
          ) : null}
          <div>
            <Gauge
              label="Avancement"
              pct={avancement.pct}
              hint={avancement.manuel ? `Ajusté : ${p.avancement_manuel_motif ?? ""}` : "Étapes clés terminées"}
            />
            {canEdit && !archived && (
              <AvancementAjuster
                projectId={id}
                manuelPct={p.avancement_manuel_pct ?? null}
                motif={p.avancement_manuel_motif ?? null}
                autoPct={p.avancement_pct ?? null}
              />
            )}
          </div>
          {type !== "suivi_simple" && (
            <Gauge label="Budget consommé" pct={null} hint="Montant engagé / budget prévu, dès que le budget sera saisi" color="var(--success)" />
          )}
        </div>
      </header>

      {/* ─── Onglets ─── */}
      {tabs.length > 1 && (
        <nav className="pj-life-tabs" aria-label="Sections du projet">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === tabs[0].key ? `/admin/projects/${id}` : `/admin/projects/${id}?onglet=${t.key}`}
              className={`pj-life-tab${current === t.key ? " is-active" : ""}`}
              aria-current={current === t.key ? "page" : undefined}
              scroll={false}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="civiq-card pj-life-panel">
        {(current === "etapes" || current === "retroplanning") && (
          <EtapesEditor
            projectId={id}
            initial={detail.milestones}
            documents={detail.documents}
            contactsByEtape={detail.milestone_contacts}
            directory={directory}
            canEdit={canEdit && !archived}
            mode={current === "retroplanning" ? "retroplanning" : "etapes"}
          />
        )}

        {current === "partenaires" && (
          <PartiesPrenantesEditor
            projectId={id}
            initial={detail.stakeholders}
            directory={directory}
            canEdit={canEdit && !archived}
            defaultCategorie="citoyenne"
            title="Partenaires"
          />
        )}

        {current === "documents" && (
          <section aria-labelledby="docs-titre">
            <h2 id="docs-titre" className="pj-section-title">Documents</h2>
            <DocumentsEditor projectId={id} initial={detail.documents} canEdit={canEdit && !archived} />
          </section>
        )}

        {current === "devis" && (
          <section aria-labelledby="devis-titre">
            <h2 id="devis-titre" className="pj-section-title">Devis</h2>
            <QuotesComparator projectId={id} phase={p.phase} canEdit={canEdit && !archived} />
          </section>
        )}

        {current === "budget" && (
          <section aria-labelledby="budget-titre">
            <h2 id="budget-titre" className="pj-section-title">
              {type === "evenementiel" ? "Budget de l'événement" : "Budget"}
            </h2>
            {(budgetLines ?? []).length === 0 ? (
              <p className="pj-section-empty">Aucune ligne de budget pour l&apos;instant.</p>
            ) : (
              <div className="pj-table-wrap">
                <table className="pj-table">
                  <caption className="pj-sr-only">Lignes de budget</caption>
                  <thead><tr><th scope="col">Sens</th><th scope="col">Catégorie</th><th scope="col">Libellé</th><th scope="col">Prévu</th><th scope="col">Réel</th></tr></thead>
                  <tbody>
                    {(budgetLines ?? []).map((b) => (
                      <tr key={b.id}>
                        <td>{b.sens === "recette" ? "Recette" : "Dépense"}</td>
                        <td>{b.categorie ? BUDGET_CATEGORIE_LABELS[b.categorie as BudgetCategorie] : "—"}</td>
                        <td>{b.libelle}</td>
                        <td>{b.montant_prevu === null ? "—" : formatEuros(Number(b.montant_prevu))}</td>
                        <td>{b.montant_reel === null ? "—" : formatEuros(Number(b.montant_reel))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="pj-wiz-note">
              La saisie du budget arrive dans une prochaine version de cet écran. En attendant, modifiez-le depuis la{" "}
              <Link href={legacyHref}>vue détaillée</Link>.
            </p>
          </section>
        )}

        {current === "financeurs" && (
          <section aria-labelledby="fin-titre">
            <h2 id="fin-titre" className="pj-section-title">Financeurs</h2>
            {detail.financings.length === 0 ? (
              <p className="pj-section-empty">Aucune demande de subvention enregistrée.</p>
            ) : (
              <ul className="pj-pp-list">
                {detail.financings.map((f) => (
                  <li key={f.id} className="pj-pp-item">
                    <div>
                      <p className="pj-pp-nom">{f.financeur}{f.dispositif ? ` — ${f.dispositif}` : ""}</p>
                      <p className="pj-pp-meta">
                        {FINANCING_STATUS_LABELS[f.statut as FinancingStatus]}
                        {f.montant_demande ? ` · demandé ${formatEuros(Number(f.montant_demande))}` : ""}
                        {f.montant_obtenu ? ` · obtenu ${formatEuros(Number(f.montant_obtenu))}` : ""}
                        {` · accusé de réception : ${f.date_ar ? formatEtapeDate(`${f.date_ar}T00:00:00.000Z`) : "non enregistré"}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="pj-wiz-note">
              Le suivi des subventions arrive dans une prochaine version de cet écran. En attendant, modifiez-le depuis la{" "}
              <Link href={legacyHref}>vue détaillée</Link>.
            </p>
          </section>
        )}
      </div>

      {type === "suivi_simple" && canEdit && !archived && (
        <SuiviActions projectId={id} hasDevis={blocsSupp.includes("devis")} />
      )}
    </main>
  );
}
