import Link from "next/link";
import { AlertTriangle, Clock, Wallet, ImageIcon, User } from "lucide-react";
import { formatEuros } from "@/lib/projects/cost-calc";
import { SECURED_FINANCING_STATUSES, type ProjectPhase } from "@/lib/projects/types";
import type { ProjectListItem } from "@/lib/projects/queries";

interface Props {
  project: ProjectListItem;
  financingStatuses: string[];
}

// ═══════════════════════════════════════════════════════════════
// ProjectCard — card moderne avec photo de couverture, titre,
// description courte, pilotes et badges d'alerte.
// ═══════════════════════════════════════════════════════════════

export default function ProjectCard({ project, financingStatuses }: Props) {
  const pilotes = [
    project.pilote_elu_profile?.full_name,
    project.pilote_agent_profile?.full_name,
  ].filter(Boolean) as string[];

  const financingSecured =
    project.sans_subvention ||
    financingStatuses.some((s) =>
      (SECURED_FINANCING_STATUSES as string[]).includes(s),
    );

  const showFinancingWarn =
    !financingSecured &&
    (project.phase === "financement" || project.phase === "conception_marches" as ProjectPhase);

  const lateMs = project.late_milestones_count ?? 0;
  const desc = project.description?.trim();
  const photo = (project as ProjectListItem & { photo_url?: string | null }).photo_url ?? null;

  return (
    <Link
      href={`/admin/projects/${project.id}`}
      className="pj-card"
      prefetch={false}
    >
      <div className="pj-card-media" aria-hidden>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="pj-card-photo" />
        ) : (
          <div className="pj-card-photo-fallback">
            <ImageIcon size={28} strokeWidth={1.5} />
          </div>
        )}
        {(showFinancingWarn || lateMs > 0) && (
          <div className="pj-card-alerts">
            {showFinancingWarn && (
              <span className="civiq-badge civiq-badge-warning" title="Porte de financement non franchie">
                <AlertTriangle size={11} /> Subv.
              </span>
            )}
            {lateMs > 0 && (
              <span className="civiq-badge civiq-badge-warning" title="Étapes clés en retard">
                <Clock size={11} /> {lateMs} retard
              </span>
            )}
          </div>
        )}
      </div>
      <div className="pj-card-body">
        <h3 className="pj-card-title">{project.titre}</h3>
        {desc && <p className="pj-card-desc">{desc}</p>}
        <div className="pj-card-meta">
          {project.budget_estime > 0 && (
            <span className="pj-card-meta-item" title="Budget estimé">
              <Wallet size={12} /> {formatEuros(project.budget_estime)}
            </span>
          )}
          {pilotes[0] && (
            <span className="pj-card-meta-item" title="Pilote">
              <User size={12} /> {pilotes[0]}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
