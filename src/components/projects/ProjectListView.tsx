import Link from "next/link";
import PhaseIcon from "./PhaseIcon";
import { PROJECT_PHASE_LABELS, type ProjectPhase } from "@/lib/projects/types";
import { formatEuros } from "@/lib/projects/cost-calc";
import type { ProjectListItem } from "@/lib/projects/queries";
import { Handshake } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// ProjectListView — liste tabulaire des projets.
//
// Une ligne par projet avec, à gauche, une BARRE VERTICALE
// colorée pour chaque commission attachée (code couleur instantané).
// Vignette de la phase en cours, montant total, % avancement
// subvention, et badge « tiers » si le projet est porté par un
// tiers. Cliquer la ligne ouvre la fiche.
// ═══════════════════════════════════════════════════════════════

interface Props {
  projects: ProjectListItem[];
}

export default function ProjectListView({ projects }: Props) {
  return (
    <div className="pj-list-wrap">
      <div className="pj-list-header" role="row">
        <div className="pj-list-col-bar" aria-hidden />
        <div className="pj-list-col-titre">Projet</div>
        <div className="pj-list-col-phase">Étape</div>
        <div className="pj-list-col-commissions">Commission(s)</div>
        <div className="pj-list-col-budget">Budget</div>
        <div className="pj-list-col-financement">Financement</div>
      </div>

      <ul className="pj-list">
        {projects.map((p) => {
          const demande = p.financing_total_demande ?? 0;
          const obtenu = p.financing_total_obtenu ?? 0;
          const budget = Number(p.budget_estime ?? 0);
          const pctObtenu = budget > 0 ? Math.min(100, Math.round((obtenu / budget) * 100)) : 0;
          const pctDemande = budget > 0 ? Math.min(100, Math.round((demande / budget) * 100)) : 0;

          return (
            <li key={p.id} className="pj-list-item-wrap">
              {/* Barres verticales : une par commission attachée. */}
              <div className="pj-list-bars" aria-hidden>
                {(p.commissions ?? []).length === 0 ? (
                  <span className="pj-list-bar pj-list-bar-empty" />
                ) : (
                  (p.commissions ?? []).map((c) => (
                    <span
                      key={c.id}
                      className="pj-list-bar"
                      style={{ background: c.color }}
                      title={c.nom}
                    />
                  ))
                )}
              </div>

              <Link
                href={`/admin/projects/${p.id}`}
                className="pj-list-item"
                prefetch={false}
              >
                <div className="pj-list-titre-cell">
                  <strong className="pj-list-titre">{p.titre}</strong>
                  <div className="pj-list-meta">
                    {p.concerne_tiers && (
                      <span className="pj-list-pill pj-list-pill-tiers">
                        <Handshake size={11} aria-hidden /> Tiers
                        {p.accompagne_sans_financer ? " · non financé" : ""}
                      </span>
                    )}
                    {p.description && (
                      <span className="pj-list-desc">{p.description}</span>
                    )}
                  </div>
                </div>

                <div className="pj-list-phase-cell">
                  <div className="pj-list-phase-badge">
                    <PhaseIcon phase={p.phase as ProjectPhase} size={14} strokeWidth={2} />
                  </div>
                  <span className="pj-list-phase-label">
                    {PROJECT_PHASE_LABELS[p.phase as ProjectPhase]}
                  </span>
                </div>

                <div className="pj-list-commissions-cell">
                  {(p.commissions ?? []).length === 0 ? (
                    <span className="pj-list-muted">—</span>
                  ) : (
                    (p.commissions ?? []).map((c) => (
                      <span
                        key={c.id}
                        className="pj-list-commission-chip"
                        style={{
                          background: `${c.color}18`,
                          color: c.color,
                          borderColor: `${c.color}40`,
                        }}
                        title={c.nom}
                      >
                        {c.nom}
                      </span>
                    ))
                  )}
                </div>

                <div className="pj-list-budget-cell">
                  <span className="pj-list-budget">{formatEuros(budget)}</span>
                </div>

                <div className="pj-list-financement-cell">
                  {p.accompagne_sans_financer ? (
                    <span className="pj-list-muted">—</span>
                  ) : budget > 0 ? (
                    <>
                      <div className="pj-list-progress" aria-hidden>
                        <div
                          className="pj-list-progress-demande"
                          style={{ width: `${pctDemande}%` }}
                        />
                        <div
                          className="pj-list-progress-obtenu"
                          style={{ width: `${pctObtenu}%` }}
                        />
                      </div>
                      <span className="pj-list-financement-meta">
                        {formatEuros(obtenu)} obtenu · {formatEuros(demande)} demandé
                      </span>
                    </>
                  ) : (
                    <span className="pj-list-muted">Budget non défini</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
