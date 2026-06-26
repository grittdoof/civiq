import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, BarChart3, Users, CalendarDays, LayoutGrid, List, TrendingUp } from "lucide-react";
import "./projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listProjects } from "@/lib/projects/queries";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_HINTS,
  type ProjectPhase,
} from "@/lib/projects/types";
import ProjectCard from "@/components/projects/ProjectCard";
import PhaseIcon from "@/components/projects/PhaseIcon";
import ProjectsListExperience from "@/components/projects/ProjectsListExperience";

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
  searchParams: Promise<{ view?: string }>;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const { view } = await searchParams;
  // Vue par défaut : liste. Vue lanes (kanban par phase) en alternative.
  const viewMode: "lanes" | "list" = view === "lanes" ? "lanes" : "list";

  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const projects = await listProjects(ctx.communeId);

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

  const byPhase = new Map<ProjectPhase, typeof projects>();
  for (const p of PROJECT_PHASES) byPhase.set(p, []);
  for (const p of projects) byPhase.get(p.phase)!.push(p);

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
              href="/admin/projects"
              className={`pj-view-toggle-btn${viewMode === "list" ? " is-active" : ""}`}
              role="tab"
              aria-selected={viewMode === "list"}
              prefetch={false}
              title="Vue liste avec filtres et code couleur commission"
            >
              <List size={14} /> <span>Liste</span>
            </Link>
            <Link
              href="/admin/projects?view=lanes"
              className={`pj-view-toggle-btn${viewMode === "lanes" ? " is-active" : ""}`}
              role="tab"
              aria-selected={viewMode === "lanes"}
              prefetch={false}
              title="Vue par phase (lanes)"
            >
              <LayoutGrid size={14} /> <span>Phases</span>
            </Link>
          </div>
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
          {PROJECT_PHASES.map((phase) => {
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
