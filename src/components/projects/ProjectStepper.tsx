import { Check } from "lucide-react";
import { PROJECT_PHASES, PROJECT_PHASE_LABELS, type ProjectPhase } from "@/lib/projects/types";

interface Props {
  current: ProjectPhase;
}

// ═══════════════════════════════════════════════════════════════
// Bandeau d'avancement des 7 étapes (read-only).
// Le bouton de transition est dans le client component séparé.
// ═══════════════════════════════════════════════════════════════

export default function ProjectStepper({ current }: Props) {
  const currentIdx = PROJECT_PHASES.indexOf(current);
  return (
    <ol className="pj-stepper" aria-label="Avancement du projet">
      {PROJECT_PHASES.map((phase, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li
            key={phase}
            className={`pj-stepper-step ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
          >
            <div className="pj-stepper-dot">
              {done ? <Check size={12} strokeWidth={3} /> : <span>{i + 1}</span>}
            </div>
            <div className="pj-stepper-label">{PROJECT_PHASE_LABELS[phase]}</div>
          </li>
        );
      })}
    </ol>
  );
}
