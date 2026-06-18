import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, BarChart3, Users, CalendarDays } from "lucide-react";
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
import { formatEuros } from "@/lib/projects/cost-calc";
import ProjectCard from "@/components/projects/ProjectCard";
import PhaseIcon from "@/components/projects/PhaseIcon";

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

export default async function ProjectsPage() {
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

  const totalInvest = projects.reduce((sum, p) => sum + (p.budget_estime ?? 0), 0);
  let totalActualise = 0;
  for (const p of projects) {
    const { data: gc } = await service.rpc("project_global_cost", { p_project_id: p.id });
    type Row = { total_actualise: number };
    const row = (gc as Row[] | null)?.[0];
    if (row) totalActualise += Number(row.total_actualise);
  }
  const resteACharge = totalInvest - totalObtenu;

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
          <Link href="/admin/projects/comparatif" className="civiq-btn civiq-btn-outline">
            <BarChart3 size={14} /> <span>Comparatif coûts</span>
          </Link>
          <Link href="/admin/projects/cartographie" className="civiq-btn civiq-btn-outline">
            <Users size={14} /> <span>Parties prenantes</span>
          </Link>
          <Link href="/admin/projects/revue-mensuelle" className="civiq-btn civiq-btn-outline">
            <CalendarDays size={14} /> <span>Revue mensuelle</span>
          </Link>
          {canCreate && (
            <Link href="/admin/projects/nouveau" className="civiq-btn civiq-btn-default">
              <Plus size={14} /> Nouveau projet
            </Link>
          )}
        </div>
      </div>

      <section className="pj-summary-bar">
        <div className="pj-summary-card">
          <div className="pj-summary-label">Projets</div>
          <div className="pj-summary-value">{projects.length}</div>
        </div>
        <div className="pj-summary-card">
          <div className="pj-summary-label">Investissement prévu</div>
          <div className="pj-summary-value">{formatEuros(totalInvest)}</div>
        </div>
        <div className="pj-summary-card">
          <div className="pj-summary-label">Subventions demandées</div>
          <div className="pj-summary-value">{formatEuros(totalDemande)}</div>
        </div>
        <div className="pj-summary-card">
          <div className="pj-summary-label">Subventions obtenues</div>
          <div className="pj-summary-value pj-summary-value-success">{formatEuros(totalObtenu)}</div>
        </div>
        <div className="pj-summary-card">
          <div className="pj-summary-label">Reste à charge commune</div>
          <div className="pj-summary-value pj-summary-value-warn">{formatEuros(resteACharge)}</div>
        </div>
        <div className="pj-summary-card">
          <div className="pj-summary-label">Coût global actualisé cumulé</div>
          <div className="pj-summary-value">{formatEuros(totalActualise)}</div>
        </div>
      </section>

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
