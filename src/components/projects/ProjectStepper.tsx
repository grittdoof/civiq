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
  current: ProjectPhase;
}

// ═══════════════════════════════════════════════════════════════
// Stepper responsive — pictogrammes Lucide fins et neutres.
// ═══════════════════════════════════════════════════════════════

export default function ProjectStepper({ current }: Props) {
  const currentIdx = PROJECT_PHASES.indexOf(current);
  const progress = ((currentIdx + 1) / PROJECT_PHASES.length) * 100;

  return (
    <>
      {/* ─── Mobile : carte verticale + barre de progression ─── */}
      <div className="pj-stepper-mobile">
        <div className="pj-stepper-mobile-card">
          <div className="pj-stepper-mobile-icon" aria-hidden>
            <PhaseIcon phase={current} size={32} strokeWidth={1.5} />
          </div>
          <div className="pj-stepper-mobile-body">
            <div className="pj-stepper-mobile-step">
              Étape {currentIdx + 1} / {PROJECT_PHASES.length}
            </div>
            <div className="pj-stepper-mobile-label">
              {PROJECT_PHASE_LABELS[current]}
            </div>
            <div className="pj-stepper-mobile-hint">
              {PROJECT_PHASE_HINTS[current]}
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
              const active = i === currentIdx;
              return (
                <li
                  key={phase}
                  className={`pj-stepper-mobile-item ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
                >
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
          const active = i === currentIdx;
          return (
            <li
              key={phase}
              className={`pj-stepper-step ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
              title={PROJECT_PHASE_HINTS[phase]}
            >
              <div className="pj-stepper-icon" aria-hidden>
                <PhaseIcon phase={phase} size={20} strokeWidth={1.75} />
              </div>
              <div className="pj-stepper-dot">
                {done ? <Check size={12} strokeWidth={3} /> : <span>{i + 1}</span>}
              </div>
              <div className="pj-stepper-label">{PROJECT_PHASE_SHORT[phase]}</div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
