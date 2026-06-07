import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Ticket, ExternalLink } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getProject, listStakeholders, getCommuneSettings } from "@/lib/projects/queries";
import {
  PROJECT_PHASE_LABELS,
  type ProjectPhase,
} from "@/lib/projects/types";
import { formatEuros } from "@/lib/projects/cost-calc";
import ProjectStepper from "@/components/projects/ProjectStepper";
import ProjectPhaseAdvanceDialog from "@/components/projects/ProjectPhaseAdvanceDialog";
import FinancingsEditor from "@/components/projects/FinancingsEditor";
import StakeholdersEditor from "@/components/projects/StakeholdersEditor";
import LifecycleCostsEditor from "@/components/projects/LifecycleCostsEditor";
import MilestonesEditor from "@/components/projects/MilestonesEditor";
import BilanEditor from "@/components/projects/BilanEditor";
import SubscribersEditor from "@/components/projects/SubscribersEditor";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/:id — Fiche projet
//
// Server component qui charge toutes les relations + l'annuaire
// commune (stakeholders, profiles), puis délègue chaque bloc à un
// éditeur client si l'utilisateur a les droits (admin/editor).
// Sinon : lecture seule.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const [detail, stakeholdersDir, settings] = await Promise.all([
    getProject(ctx.communeId, id),
    listStakeholders(ctx.communeId),
    getCommuneSettings(ctx.communeId),
  ]);

  if (!detail.project) notFound();
  const p = detail.project;
  const canEdit = ["admin", "editor", "super_admin"].includes(ctx.role ?? "");
  const isAdmin = ["admin", "super_admin"].includes(ctx.role ?? "");

  // Annuaire des profiles commune pour l'ajout d'abonnés
  const service = await createServiceClient();
  const { data: profilesDir } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("commune_id", ctx.communeId);
  const profileDirectory = (profilesDir ?? []) as Array<{ id: string; full_name: string | null }>;

  // Taux à passer à l'éditeur lifecycle (override projet > commune > default)
  const taux_inflation =
    p.taux_inflation ?? settings?.taux_inflation ?? 2.0;
  const taux_actualisation =
    p.taux_actualisation ?? settings?.taux_actualisation ?? 4.0;

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Tous les projets
        </Link>
      </div>

      <header className="pj-detail-header">
        <div className="pj-detail-title-block">
          <h1 className="civiq-page-title">{p.titre}</h1>
          <div className="pj-detail-pilotes">
            {p.pilote_elu_profile?.full_name && (
              <span className="civiq-badge civiq-badge-default">
                Élu : {p.pilote_elu_profile.full_name}
              </span>
            )}
            {p.pilote_agent_profile?.full_name && (
              <span className="civiq-badge civiq-badge-default">
                Agent : {p.pilote_agent_profile.full_name}
              </span>
            )}
            <span className="civiq-badge civiq-badge-muted">
              Compétence : {labelCompetence(p.competence)}
            </span>
            {p.sans_subvention && (
              <span className="civiq-badge civiq-badge-warning">Autofinancement assumé</span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="pj-detail-header-actions">
            <Link href={`/admin/projects/${p.id}/edit`} className="civiq-btn civiq-btn-outline">
              <Edit size={14} /> Modifier
            </Link>
            <a
              href={`/api/projects/${p.id}/pdf`}
              className="civiq-btn civiq-btn-outline"
              target="_blank"
              rel="noreferrer"
            >
              📄 Exporter en PDF
            </a>
          </div>
        )}
      </header>

      {detail.source_ticket && (
        <div className="civiq-card pj-source-ticket">
          <Ticket size={16} />
          <span>
            Projet issu du ticket{" "}
            <Link href={`/admin/tickets/${detail.source_ticket.id}`}>
              #{detail.source_ticket.numero} — {detail.source_ticket.titre}
            </Link>
          </span>
        </div>
      )}

      <ProjectStepper current={p.phase} />

      {canEdit && (
        <ProjectPhaseAdvanceDialog
          projectId={p.id}
          currentPhase={p.phase}
          isAdmin={isAdmin}
        />
      )}

      <div className="pj-detail-grid">
        {/* ── Objectifs ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">Objectifs</h2>
          {p.description && <p className="pj-section-description">{p.description}</p>}
          {p.objectifs ? (
            <p className="pj-section-content">{p.objectifs}</p>
          ) : (
            <p className="pj-section-empty">
              Pas d&apos;objectifs renseignés. {canEdit && <Link href={`/admin/projects/${p.id}/edit`}>Modifier</Link>}
            </p>
          )}
        </section>

        {/* ── Synthèse financière (lecture, calcul en BDD) ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">Synthèse financière</h2>
          <div className="pj-cost-grid">
            <div className="pj-cost-cell">
              <div className="pj-cost-label">Coût d&apos;investissement</div>
              <div className="pj-cost-value">{formatEuros(p.budget_estime)}</div>
            </div>
            {detail.global_cost && (
              <>
                <div className="pj-cost-cell">
                  <div className="pj-cost-label">Coût global nominal (10 ans)</div>
                  <div className="pj-cost-value">
                    {formatEuros(detail.global_cost.total_nominal)}
                  </div>
                </div>
                <div className="pj-cost-cell pj-cost-cell-highlight">
                  <div className="pj-cost-label">Coût global actualisé</div>
                  <div className="pj-cost-value">
                    {formatEuros(detail.global_cost.total_actualise)}
                  </div>
                  <div className="pj-cost-rates">
                    Inflation {detail.global_cost.taux_inflation_used.toFixed(1)} % ·
                    Actualisation {detail.global_cost.taux_actualisation_used.toFixed(1)} %
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Parties prenantes (RACI) — éditeur ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Parties prenantes <span className="pj-section-count">({detail.stakeholders.length})</span>
          </h2>
          {canEdit ? (
            <StakeholdersEditor
              projectId={p.id}
              initial={detail.stakeholders}
              directory={stakeholdersDir}
            />
          ) : (
            <p className="pj-section-empty">Lecture seule.</p>
          )}
        </section>

        {/* ── Plan de financement — éditeur ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Plan de financement <span className="pj-section-count">({detail.financings.length})</span>
          </h2>
          {canEdit ? (
            <FinancingsEditor
              projectId={p.id}
              initial={detail.financings}
              sansSubvention={p.sans_subvention}
            />
          ) : (
            <p className="pj-section-empty">Lecture seule.</p>
          )}
        </section>

        {/* ── Coûts 10 ans — éditeur grille ── */}
        <section className="civiq-card pj-section pj-section-wide">
          <h2 className="pj-section-title">
            Coûts de fonctionnement &amp; d&apos;entretien sur 10 ans
          </h2>
          <p className="pj-section-description">
            Saisis en euros constants (valeur d&apos;aujourd&apos;hui). Le coût global
            actualisé prend en compte l&apos;inflation et le taux d&apos;actualisation.
            <em> C&apos;est souvent l&apos;élément clé d&apos;arbitrage.</em>
          </p>
          {canEdit ? (
            <LifecycleCostsEditor
              projectId={p.id}
              initial={detail.lifecycle}
              budget_estime={p.budget_estime}
              taux_inflation={taux_inflation}
              taux_actualisation={taux_actualisation}
            />
          ) : (
            <p className="pj-section-empty">Lecture seule.</p>
          )}
        </section>

        {/* ── Jalons — éditeur ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Jalons <span className="pj-section-count">({detail.milestones.length})</span>
          </h2>
          {canEdit ? (
            <MilestonesEditor
              projectId={p.id}
              initial={detail.milestones}
              currentPhase={p.phase}
            />
          ) : (
            <p className="pj-section-empty">Lecture seule.</p>
          )}
        </section>

        {/* ── Bilan (à partir de realisation) — éditeur ── */}
        {(p.phase === "realisation" || p.phase === "bilan_cloture") && (
          <section className="civiq-card pj-section">
            <h2 className="pj-section-title">Bilan de réalisation</h2>
            {canEdit ? (
              <BilanEditor
                projectId={p.id}
                budget_estime={p.budget_estime}
                cout_reel={p.cout_reel}
                explication_ecart={p.explication_ecart}
              />
            ) : (
              <p className="pj-section-empty">Lecture seule.</p>
            )}
          </section>
        )}

        {/* ── Documents ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Documents <span className="pj-section-count">({detail.documents.length})</span>
          </h2>
          {detail.documents.length === 0 ? (
            <p className="pj-section-empty">Aucun document joint.</p>
          ) : (
            <ul className="pj-docs">
              {detail.documents.map((d) => (
                <li key={d.id}>
                  <a href={d.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={12} /> {d.nom}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Abonnés — éditeur ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Abonnés aux notifications <span className="pj-section-count">({detail.subscribers.length})</span>
          </h2>
          {canEdit ? (
            <SubscribersEditor
              projectId={p.id}
              initial={detail.subscribers}
              directory={profileDirectory}
              currentUserId={ctx.userId}
            />
          ) : (
            <p className="pj-section-empty">Lecture seule.</p>
          )}
        </section>

        {/* ── Historique des transitions ── */}
        <section className="civiq-card pj-section pj-history">
          <h2 className="pj-section-title">Historique des transitions</h2>
          {detail.phase_log.length === 0 ? (
            <p className="pj-section-empty">Aucune transition enregistrée.</p>
          ) : (
            <ol className="pj-history-list">
              {detail.phase_log.map((l) => (
                <li key={l.id}>
                  <div className="pj-history-when">
                    {new Date(l.created_at).toLocaleString("fr-FR")}
                  </div>
                  <div className="pj-history-what">
                    {l.from_phase ? PROJECT_PHASE_LABELS[l.from_phase] : "—"}{" → "}
                    <strong>{PROJECT_PHASE_LABELS[l.to_phase as ProjectPhase]}</strong>
                    {l.forced && <span className="civiq-badge civiq-badge-warning"> Forcé</span>}
                  </div>
                  {l.commentaire && (
                    <div className="pj-history-comment">{l.commentaire}</div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

function labelCompetence(c: string): string {
  switch (c) {
    case "communale": return "Communale";
    case "intercommunale": return "Intercommunale";
    case "a_verifier": return "À vérifier";
    default: return c;
  }
}
