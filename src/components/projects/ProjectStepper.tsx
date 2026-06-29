import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_SHORT,
  PROJECT_PHASE_HINTS,
  type ProjectPhase,
} from "@/lib/projects/types";
import PhaseIcon from "./PhaseIcon";

interface Props {
  /** Phase actuelle du projet (sa vraie phase BDD). */
  current: ProjectPhase;
  /** Phase affichée à l'écran. Si omis, équivaut à `current`. */
  focused?: ProjectPhase;
  /** Si fourni, chaque étape devient un Link vers /phase/[phase]. */
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════
// Stepper responsive — pictogrammes Lucide fins et neutres.
//
// Chaque étape peut être cliquable (si projectId est fourni) pour
// permettre la navigation entre phases dans le nouveau flow. Le
// rendu visuel reste celui de la version classique :
//   - icône au-dessus
//   - cercle numéroté (check si fait, numéro sinon)
//   - libellé en bas
//   - ligne horizontale verte/grise entre les étapes
// ═══════════════════════════════════════════════════════════════

export default function ProjectStepper({ current, focused, projectId }: Props) {
  const currentIdx = PROJECT_PHASES.indexOf(current);
  const focusedPhase = focused ?? current;
  const focusedIdx = PROJECT_PHASES.indexOf(focusedPhase);
  const progress = ((currentIdx + 1) / PROJECT_PHASES.length) * 100;

  return (
    <>
      {/* ─── Mobile : carte verticale + barre de progression ─── */}
      <div className="pj-stepper-mobile">
        <div className="pj-stepper-mobile-card">
          <div className="pj-stepper-mobile-icon" aria-hidden>
            <PhaseIcon phase={focusedPhase} size={32} strokeWidth={1.5} />
          </div>
          <div className="pj-stepper-mobile-body">
            <div className="pj-stepper-mobile-step">
              Étape {focusedIdx + 1} / {PROJECT_PHASES.length}
            </div>
            <div className="pj-stepper-mobile-label">
              {PROJECT_PHASE_LABELS[focusedPhase]}
            </div>
            <div className="pj-stepper-mobile-hint">
              {PROJECT_PHASE_HINTS[focusedPhase]}
            </div>
          </div>
        </div>
        <div className="pj-stepper-mobile-progress" aria-label="Progression">
          <div
            className="pj-stepper-mobile-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <details className="pj-stepper-mobile-details">
          <summary>Voir toutes les étapes</summary>
          <ol className="pj-stepper-mobile-list">
            {PROJECT_PHASES.map((phase, i) => {
              const done = i < currentIdx;
              const active = phase === focusedPhase;
              const cls = `pj-stepper-mobile-item ${done ? "is-done" : ""} ${active ? "is-active" : ""}`;
              const inner = (
                <>
                  <span className="pj-stepper-mobile-item-bullet">
                    {done ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="pj-stepper-mobile-item-icon" aria-hidden>
                    <PhaseIcon phase={phase} size={16} />
                  </span>
                  <span className="pj-stepper-mobile-item-label">
                    {PROJECT_PHASE_LABELS[phase]}
                  </span>
                  {active && (
                    <ChevronRight
                      size={14}
                      className="pj-stepper-mobile-item-cursor"
                    />
                  )}
                </>
              );
              return (
                <li key={phase} className={cls}>
                  {projectId ? (
                    <Link
                      href={`/admin/projects/${projectId}/phase/${phase}`}
                      className="pj-stepper-mobile-item-link"
                      prefetch={false}
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ol>
        </details>
      </div>

      {/* ─── Desktop : grille 7 colonnes sans scroll ─── */}
      <ol className="pj-stepper" aria-label="Avancement du projet">
        {PROJECT_PHASES.map((phase, i) => {
          const done = i < currentIdx;
          const active = phase === focusedPhase;
          const cls = `pj-stepper-step ${done ? "is-done" : ""} ${active ? "is-active" : ""}`;
          const inner = (
            <>
              <div className="pj-stepper-icon" aria-hidden>
                <PhaseIcon phase={phase} size={20} strokeWidth={1.75} />
              </div>
              <div className="pj-stepper-dot">
                {done ? (
                  <Check size={12} strokeWidth={3} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <div className="pj-stepper-label">{PROJECT_PHASE_SHORT[phase]}</div>
            </>
          );
          return (
            <li key={phase} className={cls} title={PROJECT_PHASE_HINTS[phase]}>
              {projectId ? (
                <Link
                  href={`/admin/projects/${projectId}/phase/${phase}`}
                  className="pj-stepper-link"
                  prefetch={false}
                >
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
