import Link from "next/link";
import { AlertTriangle, Clock, Wallet } from "lucide-react";
import { formatEuros } from "@/lib/projects/cost-calc";
import { SECURED_FINANCING_STATUSES, type ProjectPhase } from "@/lib/projects/types";
import type { ProjectListItem } from "@/lib/projects/queries";

interface Props {
  project: ProjectListItem;
  /** Projet possède au moins une subvention sécurisée ou sans_subvention=true */
  financingSecured: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Carte d'un projet dans la vue kanban. Compacte mais riche :
// titre, pilotes, budget, alerte porte de financement non franchie,
// jalons en retard.
// ═══════════════════════════════════════════════════════════════

export default function ProjectKanbanCard({ project, financingSecured }: Props) {
  const pilotes = [
    project.pilote_elu_profile?.full_name,
    project.pilote_agent_profile?.full_name,
  ].filter(Boolean) as string[];

  const showFinancingWarn =
    !financingSecured &&
    (project.phase === "financement" || project.phase === "conception_marches");

  const lateMilestones = project.late_milestones_count ?? 0;

  return (
    <Link
      href={`/admin/projects/${project.id}`}
      className="civiq-card pj-kanban-card"
      prefetch={false}
    >
      <div className="pj-kanban-card-title">{project.titre}</div>

      {pilotes.length > 0 && (
        <div className="pj-kanban-card-pilotes">
          {pilotes.map((p, i) => (
            <span key={i} className="pj-kanban-card-pilote">{p}</span>
          ))}
        </div>
      )}

      <div className="pj-kanban-card-meta">
        {project.budget_estime > 0 && (
          <span className="pj-kanban-card-budget" title="Budget estimé">
            <Wallet size={12} /> {formatEuros(project.budget_estime)}
          </span>
        )}
        {lateMilestones > 0 && (
          <span className="civiq-badge civiq-badge-warning" title="Jalons en retard">
            <Clock size={11} /> {lateMilestones}
          </span>
        )}
        {showFinancingWarn && (
          <span
            className="civiq-badge civiq-badge-warning"
            title="Porte de financement non franchie"
          >
            <AlertTriangle size={11} /> Subv.
          </span>
        )}
      </div>
    </Link>
  );
}

export function isFinancingSecured(
  project: ProjectListItem,
  financingStatuses: Map<string, string[]>,
): boolean {
  if (project.sans_subvention) return true;
  const statuses = financingStatuses.get(project.id) ?? [];
  return statuses.some((s) => SECURED_FINANCING_STATUSES.includes(s as never));
}

export function getPhaseColor(phase: ProjectPhase): string {
  switch (phase) {
    case "emergence": return "var(--civiq-bg-blue)";
    case "faisabilite": return "var(--civiq-bg-blue)";
    case "decision_budget": return "var(--civiq-bg-yellow)";
    case "financement": return "var(--civiq-bg-yellow)";
    case "conception_marches": return "var(--civiq-bg-coral)";
    case "realisation": return "var(--civiq-bg-green)";
    case "bilan_cloture": return "var(--civiq-bg-green)";
  }
}
