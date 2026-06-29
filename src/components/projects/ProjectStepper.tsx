import Link from "next/link";
import { Check, ChevronRight, AlertTriangle } from "lucide-react";
import {
  PROJECT_PHASES_BY_TYPE,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_SHORT,
  PROJECT_PHASE_HINTS,
  type ProjectPhase,
  type ProjectType,
} from "@/lib/projects/types";
import PhaseIcon from "./PhaseIcon";

interface Props {
  /** Phase actuelle du projet (sa vraie phase BDD). */
  current: ProjectPhase;
  /** Phase affichée à l'écran. Si omis, équivaut à `current`. */
  focused?: ProjectPhase;
  /** Si fourni, chaque étape devient un Link vers /phase/[phase]. */
  projectId?: string;
  /** Gabarit du projet. Default 'investment' pour rétrocompat. */
  type?: ProjectType;
  /**
   * Drapeau rouge éligibilité subvention (au moins un financing du
   * projet a eligibilite='compromise'). Affiche un badge alerte sur
   * la phase « réalisation » (gabarit investment uniquement).
   */
  eligibilityCompromised?: boolean;
  /** Phases marquées « non applicable » — affichage atténué. */
  phaseNotApplicable?: Record<string, string>;
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

export default function ProjectStepper({
  current,
  focused,
  projectId,
  type = "investment",
  eligibilityCompromised = false,
  phaseNotApplicable = {},
}: Props) {
  const phases = PROJECT_PHASES_BY_TYPE[type];
  const currentIdx = phases.indexOf(current);
  const focusedPhase = focused ?? current;
  const focusedIdx = phases.indexOf(focusedPhase);
  const progress = ((currentIdx + 1) / phases.length) * 100;
  // Le drapeau rouge s'affiche sur la phase « réalisation » pour
  // signaler que le commencement d'exécution menace une subvention.
  const RED_FLAG_PHASE: ProjectPhase = "realisation";

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
              Étape {focusedIdx + 1} / {phases.length}
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
            {phases.map((phase, i) => {
              const done = i < currentIdx;
              const active = phase === focusedPhase;
              const na = Boolean(phaseNotApplicable[phase]);
              const redFlag = eligibilityCompromised && phase === RED_FLAG_PHASE && type === "investment";
              const cls = `pj-stepper-mobile-item ${done ? "is-done" : ""} ${active ? "is-active" : ""} ${na ? "is-na" : ""} ${redFlag ? "has-red-flag" : ""}`;
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
                  {redFlag && (
                    <span className="pj-stepper-red-flag" title="Risque d'éligibilité : un marché ou OS est saisi avant l'AR d'une subvention">
                      <AlertTriangle size={12} />
                    </span>
                  )}
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
        {phases.map((phase, i) => {
          const done = i < currentIdx;
          const active = phase === focusedPhase;
          const na = Boolean(phaseNotApplicable[phase]);
          const redFlag = eligibilityCompromised && phase === RED_FLAG_PHASE && type === "investment";
          const cls = `pj-stepper-step ${done ? "is-done" : ""} ${active ? "is-active" : ""} ${na ? "is-na" : ""} ${redFlag ? "has-red-flag" : ""}`;
          const inner = (
            <>
              <div className="pj-stepper-icon" aria-hidden>
                <PhaseIcon phase={phase} size={20} strokeWidth={1.75} />
                {redFlag && (
                  <span className="pj-stepper-red-flag-dot" title="Risque d'éligibilité : un marché ou OS est saisi avant l'AR d'une subvention">
                    <AlertTriangle size={11} strokeWidth={2.5} />
                  </span>
                )}
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
            <li key={phase} className={cls} title={na ? phaseNotApplicable[phase] : PROJECT_PHASE_HINTS[phase]}>
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
