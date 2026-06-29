import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, BarChart3, Users, CalendarDays, LayoutGrid, List, TrendingUp } from "lucide-react";
import "./projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listProjects } from "@/lib/projects/queries";
import {
  PROJECT_PHASES_BY_TYPE,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_HINTS,
  PROJECT_TYPE_LABELS,
  type ProjectPhase,
  type ProjectType,
} from "@/lib/projects/types";
import ProjectCard from "@/components/projects/ProjectCard";
import PhaseIcon from "@/components/projects/PhaseIcon";
import ProjectsListExperience from "@/components/projects/ProjectsListExperience";

const VALID_TYPES: ProjectType[] = ["investment", "event", "tracking"];

// ═══════════════════════════════════════════════════════════════
// /admin/projects — Lanes horizontales par phase.
//
// Disposition (inversée par rapport à un kanban classique) :
//   • Les 7 phases sont des LIGNES (lanes horizontales)
//   • Les projets sont des CARDS horizontales dans leur lane
//   • Cards modernes avec photo de couverture, titre, description
//   • Pictogrammes Lucide fins (pas d'emoji)
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ view?: string; commission?: string; gabarit?: string }>;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const { view, commission: commissionParam, gabarit: gabaritParam } = await searchParams;
  // Vue par défaut : liste. Vue lanes (kanban par phase) en alternative.
  const viewMode: "lanes" | "list" = view === "lanes" ? "lanes" : "list";
  // Gabarit affiché en vue lanes (chaque gabarit a ses propres phases).
  const selectedType: ProjectType = VALID_TYPES.includes(gabaritParam as ProjectType)
    ? (gabaritParam as ProjectType)
    : "investment";

  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const allProjects = await listProjects(ctx.communeId);

  // Liste des commissions de la commune pour le filtre du portefeuille
  const service0 = await createServiceClient();
  const { data: communeCommissions } = await service0
    .from("commissions")
    .select("id, nom, color, icon")
    .eq("commune_id", ctx.communeId)
    .eq("active", true)
    .order("nom");

  // Filtrage par commission (server-side via URL ?commission=ID)
  const projects = commissionParam
    ? allProjects.filter((p) =>
        (p.commissions ?? []).some((c) => c.id === commissionParam),
      )
    : allProjects;

  const selectedCommission = commissionParam
    ? (communeCommissions ?? []).find((c) => c.id === commissionParam)
    : null;

  const service = await createServiceClient();
  const { data: allFinancings } = await service
    .from("financings")
    .select("project_id, statut, montant_demande, montant_obtenu")
    .in(
      "project_id",
      projects.length > 0 ? projects.map((p) => p.id) : ["__none__"],
    );

  const statusesByProject = new Map<string, string[]>();
  let totalDemande = 0;
  let totalObtenu = 0;
  for (const f of allFinancings ?? []) {
    const arr = statusesByProject.get(f.project_id) ?? [];
    arr.push(f.statut);
    statusesByProject.set(f.project_id, arr);
    totalDemande += Number(f.montant_demande ?? 0);
    totalObtenu += Number(f.montant_obtenu ?? 0);
  }

  // Les totaux investissement / actualisation sont désormais affichés
  // dans le drawer Statistiques (calculés côté client) — on évite ainsi
  // un N+1 sur project_global_cost à chaque chargement de page.

  // Vue lanes : on n'affiche que les projets du gabarit sélectionné
  // (chaque gabarit a son propre jeu de phases — afficher 15 lanes
  //  serait illisible et la plupart seraient vides).
  const lanePhases = PROJECT_PHASES_BY_TYPE[selectedType];
  const projectsForLanes = projects.filter((p) => p.type === selectedType);
  const byPhase = new Map<ProjectPhase, typeof projects>();
  for (const ph of lanePhases) byPhase.set(ph, []);
  for (const p of projectsForLanes) {
    if (byPhase.has(p.phase)) byPhase.get(p.phase)!.push(p);
  }

  // Helper de construction d'URL en préservant les params actifs
  function buildHref(overrides: Partial<{ view: string; commission: string; gabarit: string }>) {
    const url = new URLSearchParams();
    const v = overrides.view !== undefined ? overrides.view : (viewMode === "lanes" ? "lanes" : "");
    if (v) url.set("view", v);
    const c = overrides.commission !== undefined ? overrides.commission : (commissionParam ?? "");
    if (c) url.set("commission", c);
    const g = overrides.gabarit !== undefined ? overrides.gabarit : selectedType;
    if (g && viewMode === "lanes") url.set("gabarit", g);
    const qs = url.toString();
    return qs ? `/admin/projects?${qs}` : "/admin/projects";
  }

  const canCreate = ["admin", "editor", "super_admin"].includes(ctx.role ?? "");

  return (
    <main className="civiq-main pj-projects-page">
      <div className="pj-page-header">
        <div>
          <h1 className="civiq-page-title">Gestion de projet</h1>
          <p className="pj-page-subtitle">
            Pilotez vos investissements sur le cycle de vie complet :
            de l&apos;émergence au bilan.
          </p>
        </div>
        <div className="pj-page-header-actions">
          <div className="pj-view-toggle" role="tablist" aria-label="Affichage">
            <Link
              href={buildHref({ view: "" })}
              className={`pj-view-toggle-btn${viewMode === "list" ? " is-active" : ""}`}
              role="tab"
              aria-selected={viewMode === "list"}
              prefetch={false}
              title="Vue liste avec filtres et code couleur commission"
            >
              <List size={14} /> <span>Liste</span>
            </Link>
            <Link
              href={buildHref({ view: "lanes" })}
              className={`pj-view-toggle-btn${viewMode === "lanes" ? " is-active" : ""}`}
              role="tab"
              aria-selected={viewMode === "lanes"}
              prefetch={false}
              title="Vue par phase (lanes)"
            >
              <LayoutGrid size={14} /> <span>Phases</span>
            </Link>
          </div>

          {/* Filtre commission (préserve la vue active) */}
          {(communeCommissions?.length ?? 0) > 0 && (
            <details className="pj-portfolio-commission-filter">
              <summary
                className={`pj-view-toggle-btn${selectedCommission ? " is-active" : ""}`}
                title="Filtrer le portefeuille par commission de rattachement"
              >
                <Users size={14} />
                <span>
                  {selectedCommission ? selectedCommission.nom : "Toutes commissions"}
                </span>
              </summary>
              <div className="pj-portfolio-commission-menu">
                <Link
                  href={buildHref({ commission: "" })}
                  className={`pj-portfolio-commission-item${!selectedCommission ? " is-active" : ""}`}
                  prefetch={false}
                >
                  Toutes commissions
                </Link>
                {(communeCommissions ?? []).map((c) => (
                  <Link
                    key={c.id}
                    href={buildHref({ commission: c.id })}
                    className={`pj-portfolio-commission-item${c.id === commissionParam ? " is-active" : ""}`}
                    prefetch={false}
                  >
                    <span
                      className="pj-portfolio-commission-dot"
                      style={{ background: c.color }}
                      aria-hidden
                    />
                    {c.nom}
                  </Link>
                ))}
              </div>
            </details>
          )}

          {/* Sélecteur de gabarit (vue lanes uniquement) */}
          {viewMode === "lanes" && (
            <div className="pj-view-toggle" role="tablist" aria-label="Gabarit">
              {VALID_TYPES.map((t) => (
                <Link
                  key={t}
                  href={buildHref({ gabarit: t })}
                  className={`pj-view-toggle-btn${selectedType === t ? " is-active" : ""}`}
                  role="tab"
                  aria-selected={selectedType === t}
                  prefetch={false}
                >
                  {PROJECT_TYPE_LABELS[t]}
                </Link>
              ))}
            </div>
          )}
          <Link href="/admin/projects/comparatif" className="civiq-btn civiq-btn-outline">
            <BarChart3 size={14} /> <span>Comparatif coûts</span>
          </Link>
          <Link href="/admin/projects/cartographie" className="civiq-btn civiq-btn-outline">
            <Users size={14} /> <span>Parties prenantes</span>
          </Link>
          <Link href="/admin/projects/revue-mensuelle" className="civiq-btn civiq-btn-outline">
            <CalendarDays size={14} /> <span>Revue mensuelle</span>
          </Link>
          <Link href="/admin/projects/ppi" className="civiq-btn civiq-btn-outline">
            <TrendingUp size={14} /> <span>PPI</span>
          </Link>
          {canCreate && (
            <Link href="/admin/projects/nouveau" className="civiq-btn civiq-btn-default">
              <Plus size={14} /> Nouveau projet
            </Link>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="civiq-card pj-empty">
          <p className="pj-empty-title">Aucun projet pour l&apos;instant</p>
          <p className="pj-empty-hint">
            Créez votre premier projet d&apos;investissement.
          </p>
          {canCreate && (
            <Link href="/admin/projects/nouveau" className="civiq-btn civiq-btn-default">
              <Plus size={14} /> Nouveau projet
            </Link>
          )}
        </div>
      ) : viewMode === "list" ? (
        <ProjectsListExperience
          projects={projects}
          totalDemande={totalDemande}
          totalObtenu={totalObtenu}
        />
      ) : (
        <div className="pj-lanes">
          {projectsForLanes.length === 0 && (
            <div className="civiq-card pj-empty" style={{ marginBottom: 16 }}>
              <p className="pj-empty-title">
                Aucun projet « {PROJECT_TYPE_LABELS[selectedType].toLowerCase()} »
                {selectedCommission && ` pour la commission ${selectedCommission.nom}`}.
              </p>
              <p className="pj-empty-hint">
                Changez de gabarit ou de commission pour voir d&apos;autres projets.
              </p>
            </div>
          )}
          {lanePhases.map((phase) => {
            const items = byPhase.get(phase) ?? [];
            return (
              <section key={phase} className="pj-lane">
                <header className="pj-lane-header">
                  <div className="pj-lane-icon" aria-hidden>
                    <PhaseIcon phase={phase} size={20} strokeWidth={1.75} />
                  </div>
                  <div className="pj-lane-meta">
                    <h2 className="pj-lane-title">{PROJECT_PHASE_LABELS[phase]}</h2>
                    <p className="pj-lane-hint">{PROJECT_PHASE_HINTS[phase]}</p>
                  </div>
                  <span className="pj-lane-count">{items.length}</span>
                </header>
                {items.length === 0 ? (
                  <div className="pj-lane-empty">Aucun projet dans cette étape.</div>
                ) : (
                  <div className="pj-lane-cards">
                    {items.map((p) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        financingStatuses={statusesByProject.get(p.id) ?? []}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
