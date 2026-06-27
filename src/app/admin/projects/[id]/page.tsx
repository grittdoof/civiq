import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit, Ticket, Gavel, Info,
  Target, Coins, Users, Wallet, LineChart, Flag,
  ClipboardCheck, Files, Bell, History,
} from "lucide-react";
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
import DocumentsEditor from "@/components/projects/DocumentsEditor";
import ProjectPhotoUpload from "@/components/projects/ProjectPhotoUpload";
import CommissionIcon from "@/components/projects/CommissionIcon";
import DeleteProjectButton from "@/components/projects/DeleteProjectButton";
import ProjectSection from "@/components/projects/ProjectSection";
import PhaseGuide from "@/components/projects/PhaseGuide";

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
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  // Onglet par défaut = guidance des phases (zone de travail).
  // « fiche » = vue consolidée du projet pour relecture/modification.
  const activeTab: "phases" | "fiche" = tab === "fiche" ? "fiche" : "phases";
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
            {/* Pastille par commission rattachée : pictogramme + nom
                dans la couleur de la commission */}
            {detail.commissions.map((c) => (
              <Link
                key={c.id}
                href={`/admin/commissions/${c.id}`}
                className="pj-commission-badge"
                style={{ ['--comm-color' as string]: c.color }}
                title={`Commission ${c.nom}`}
              >
                <CommissionIcon name={c.icon} size={12} />
                <span>{c.nom}</span>
              </Link>
            ))}
          </div>
        </div>
        {canEdit && (
          <div className="pj-detail-header-actions">
            <Link href={`/admin/projects/${p.id}/edit`} className="civiq-btn civiq-btn-outline">
              <Edit size={14} /> Modifier
            </Link>
            <a
              href={`/projects-pdf?kind=project&id=${p.id}`}
              className="civiq-btn civiq-btn-outline"
              target="_blank"
              rel="noreferrer"
            >
              Exporter en PDF
            </a>
            {ctx.role === "super_admin" && (
              <DeleteProjectButton projectId={p.id} projectTitle={p.titre} />
            )}
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

      {/* Photo de couverture */}
      <ProjectPhotoUpload
        projectId={p.id}
        current={(p as typeof p & { photo_url?: string | null }).photo_url ?? null}
        canEdit={canEdit}
      />

      <ProjectStepper current={p.phase} />

      {canEdit && (
        <ProjectPhaseAdvanceDialog
          projectId={p.id}
          currentPhase={p.phase}
          isAdmin={isAdmin}
        />
      )}

      {/* ── Onglets : Phases (zone de travail) / Fiche projet (résumé) ── */}
      <div className="pj-tabs" role="tablist" aria-label="Vue projet">
        <Link
          href={`/admin/projects/${p.id}`}
          className={`pj-tab${activeTab === "phases" ? " is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "phases"}
          prefetch={false}
        >
          <span className="pj-tab-num">1</span>
          <span>Phases du projet</span>
          <span className="pj-tab-hint">Zone de travail guidée</span>
        </Link>
        <Link
          href={`/admin/projects/${p.id}?tab=fiche`}
          className={`pj-tab${activeTab === "fiche" ? " is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "fiche"}
          prefetch={false}
        >
          <span className="pj-tab-num">2</span>
          <span>Fiche projet</span>
          <span className="pj-tab-hint">Résumé consolidé</span>
        </Link>
      </div>

      {activeTab === "phases" && (
        <PhaseGuide
          projectId={p.id}
          currentPhase={p.phase}
          initialProgress={p.phase_progress ?? {}}
          canEdit={canEdit}
        />
      )}

      {activeTab === "fiche" && (
      <div className="pj-detail-grid">
        {/* ─── Rangée 1 : Objectifs en pleine largeur ─── */}
        <ProjectSection
          title="Objectifs"
          icon={<Target size={16} strokeWidth={1.9} />}
          hint="Pourquoi ce projet existe et ce qu'il doit accomplir."
        >
          {p.description && <p className="pj-section-description">{p.description}</p>}
          {p.objectifs ? (
            <p className="pj-section-content">{p.objectifs}</p>
          ) : (
            <p className="pj-section-empty">
              Pas d&apos;objectifs renseignés. {canEdit && <Link href={`/admin/projects/${p.id}/edit`}>Modifier</Link>}
            </p>
          )}
        </ProjectSection>

        {/* ─── Rangée 2 : Étapes clés (2/3) + Documents (1/3) ─── */}
        <div className="pj-detail-row pj-detail-row-2-1">
          <ProjectSection
            title="Étapes clés"
            icon={<Flag size={16} strokeWidth={1.9} />}
            count={detail.milestones.length}
            hint="Jalons et échéances qui rythment l'avancement du projet."
            endSlot={
              <span
                className="pj-info-tooltip"
                tabIndex={0}
                title="Un jalon est un événement clé : livraison, dépôt de dossier, fin de chantier… Chacun a une échéance et un responsable."
              >
                <Info size={13} />
              </span>
            }
          >
            {canEdit ? (
              <MilestonesEditor
                projectId={p.id}
                initial={detail.milestones}
                currentPhase={p.phase}
              />
            ) : (
              <p className="pj-section-empty">Lecture seule.</p>
            )}
          </ProjectSection>

          <ProjectSection
            title="Documents"
            icon={<Files size={16} strokeWidth={1.9} />}
            count={detail.documents.length}
            hint="Études, devis, pièces administratives, photos."
          >
            <DocumentsEditor
              projectId={p.id}
              initial={detail.documents}
              canEdit={canEdit}
            />
          </ProjectSection>
        </div>

        {/* ── Synthèse financière ── */}
        <ProjectSection
          title="Synthèse financière"
          icon={<Coins size={16} strokeWidth={1.9} />}
          hint="Vision rapide : investissement, coût global et actualisation."
        >
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
        </ProjectSection>

        {/* ── Plan de financement (ouvert — essentiel pour pilotage) ── */}
        <ProjectSection
          title="Plan de financement"
          icon={<Wallet size={16} strokeWidth={1.9} />}
          count={detail.financings.length}
          hint="Subventions sollicitées, obtenues et reste à charge."
        >
          {canEdit ? (
            <FinancingsEditor
              projectId={p.id}
              initial={detail.financings}
              sansSubvention={p.sans_subvention}
            />
          ) : (
            <p className="pj-section-empty">Lecture seule.</p>
          )}
        </ProjectSection>

        {/* ── Parties prenantes ── */}
        <ProjectSection
          title="Parties prenantes"
          icon={<Users size={16} strokeWidth={1.9} />}
          count={detail.stakeholders.length}
          hint="Qui décide, qui exécute, qui est informé (matrice RACI)."
        >
          {canEdit ? (
            <StakeholdersEditor
              projectId={p.id}
              initial={detail.stakeholders}
              directory={stakeholdersDir}
            />
          ) : (
            <p className="pj-section-empty">Lecture seule.</p>
          )}
        </ProjectSection>

        {/* ── Coûts 10 ans (plié) ── */}
        <ProjectSection
          title="Coûts de fonctionnement & d'entretien sur 10 ans"
          icon={<LineChart size={16} strokeWidth={1.9} />}
          hint="Élément clé d'arbitrage — saisis en euros constants."
          className="pj-section-wide"
        >
          <p className="pj-section-description">
            Saisis en euros constants (valeur d&apos;aujourd&apos;hui). Le coût global
            actualisé prend en compte l&apos;inflation et le taux d&apos;actualisation.
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
        </ProjectSection>

        {/* ── Bilan (à partir de realisation) ── */}
        {(p.phase === "realisation" || p.phase === "bilan_cloture") && (
          <ProjectSection
            title="Bilan de réalisation"
            icon={<ClipboardCheck size={16} strokeWidth={1.9} />}
            hint="Coût réel, écart vs budget initial et explications."
          >
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
          </ProjectSection>
        )}

        {/* ── Commissions (plié) ── */}
        <ProjectSection
          title="Commissions qui suivent ce projet"
          icon={<Gavel size={16} strokeWidth={1.9} />}
          count={detail.commissions.length}
          hint="Un projet peut être suivi par plusieurs commissions transversales."
        >
          {detail.commissions.length === 0 ? (
            <p className="pj-section-empty">
              Aucune commission ne suit ce projet pour le moment. La gestion
              se fait depuis la fiche commission.
            </p>
          ) : (
            <ul className="pj-subs">
              {detail.commissions.map((c) => (
                <li key={c.id} className="pj-sub-row">
                  <Link
                    href={`/admin/commissions/${c.id}`}
                    style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit", fontWeight: 600 }}
                  >
                    <Gavel size={14} /> {c.nom}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ProjectSection>

        {/* ── Abonnés ── */}
        <ProjectSection
          title="Abonnés aux notifications"
          icon={<Bell size={16} strokeWidth={1.9} />}
          count={detail.subscribers.length}
          hint="Qui reçoit les alertes lors des changements de phase et jalons."
        >
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
        </ProjectSection>

        {/* ── Historique ── */}
        <ProjectSection
          title="Historique des transitions"
          icon={<History size={16} strokeWidth={1.9} />}
          count={detail.phase_log.length}
          hint="Trace des changements de phase, dates et commentaires."
          className="pj-history"
        >
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
        </ProjectSection>
      </div>
      )}
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
