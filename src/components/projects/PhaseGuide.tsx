"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ArrowRight, MapPin, Target, Lock } from "lucide-react";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_GUIDE,
  type ProjectPhase,
} from "@/lib/projects/types";
import PhaseIcon from "./PhaseIcon";

// ═══════════════════════════════════════════════════════════════
// PhaseGuide — panneau de contexte qui donne du sens à chaque
// étape du cycle de vie. Affiché sous le stepper.
//
// Par défaut le guide montre la phase COURANTE du projet. L'utilisateur
// peut cliquer sur n'importe quelle phase du stepper interne pour
// la prévisualiser (sans changer la phase réelle du projet). C'est
// un mode « lecture / découverte » pour comprendre où on en est et
// ce qui attend.
//
// Pour chaque phase on raconte 4 choses :
//   1. « Vous arrivez avec » — ce qui est censé être déjà fait
//   2. « C'est quoi cette étape » — l'objectif principal
//   3. « Livrables-type » — la checklist concrète
//   4. « Et après » — la porte de sortie
// ═══════════════════════════════════════════════════════════════

interface Props {
  currentPhase: ProjectPhase;
}

export default function PhaseGuide({ currentPhase }: Props) {
  const [selected, setSelected] = useState<ProjectPhase>(currentPhase);
  const currentIdx = PROJECT_PHASES.indexOf(currentPhase);
  const selectedIdx = PROJECT_PHASES.indexOf(selected);
  const guide = PROJECT_PHASE_GUIDE[selected];

  // Statut de la phase sélectionnée par rapport à la phase réelle
  const status: "done" | "current" | "future" =
    selectedIdx < currentIdx
      ? "done"
      : selectedIdx === currentIdx
      ? "current"
      : "future";

  return (
    <div className="pj-phase-guide">
      {/* Mini-stepper interne cliquable */}
      <div className="pj-phase-guide-strip" role="tablist" aria-label="Étapes du projet">
        {PROJECT_PHASES.map((phase, i) => {
          const isSelected = phase === selected;
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <button
              key={phase}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`pj-phase-guide-pill${isSelected ? " is-selected" : ""}${
                isDone ? " is-done" : ""
              }${isCurrent ? " is-current" : ""}`}
              onClick={() => setSelected(phase)}
            >
              <span className="pj-phase-guide-pill-icon" aria-hidden>
                {isDone ? (
                  <CheckCircle2 size={13} />
                ) : isCurrent ? (
                  <span className="pj-phase-guide-pill-pulse" />
                ) : (
                  <Circle size={13} />
                )}
              </span>
              <span className="pj-phase-guide-pill-num">{i + 1}</span>
              <span className="pj-phase-guide-pill-label">
                {PROJECT_PHASE_LABELS[phase]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Narration de la phase sélectionnée */}
      <div className="pj-phase-guide-panel">
        <header className="pj-phase-guide-head">
          <div className="pj-phase-guide-icon" aria-hidden>
            <PhaseIcon phase={selected} size={20} strokeWidth={1.8} />
          </div>
          <div className="pj-phase-guide-title-block">
            <span className="pj-phase-guide-eyebrow">
              {status === "current" && "Étape actuelle"}
              {status === "done" && "Étape franchie"}
              {status === "future" && "Étape à venir"}
              {" "}· {selectedIdx + 1} sur {PROJECT_PHASES.length}
            </span>
            <h3 className="pj-phase-guide-title">{PROJECT_PHASE_LABELS[selected]}</h3>
          </div>
        </header>

        <div className="pj-phase-guide-grid">
          {/* Vous arrivez avec */}
          <div className="pj-phase-guide-block">
            <div className="pj-phase-guide-block-label">
              <MapPin size={12} aria-hidden />
              <span>Vous arrivez avec</span>
            </div>
            <p className="pj-phase-guide-block-text">{guide.arrivedWith}</p>
          </div>

          {/* Objectif */}
          <div className="pj-phase-guide-block">
            <div className="pj-phase-guide-block-label">
              <Target size={12} aria-hidden />
              <span>C&apos;est quoi cette étape</span>
            </div>
            <p className="pj-phase-guide-block-text">{guide.objective}</p>
          </div>
        </div>

        {/* Livrables */}
        <div className="pj-phase-guide-block">
          <div className="pj-phase-guide-block-label">
            <CheckCircle2 size={12} aria-hidden />
            <span>Livrables-type</span>
          </div>
          <ul className="pj-phase-guide-deliverables">
            {guide.deliverables.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>

        {/* Et après */}
        <div className="pj-phase-guide-gate">
          <div className="pj-phase-guide-gate-icon" aria-hidden>
            <Lock size={14} />
          </div>
          <div>
            <div className="pj-phase-guide-gate-label">Et après ?</div>
            <p className="pj-phase-guide-gate-text">
              {guide.gate}
              {selectedIdx < PROJECT_PHASES.length - 1 && (
                <>
                  {" "}
                  <ArrowRight size={11} aria-hidden style={{ verticalAlign: -1 }} />{" "}
                  <strong>
                    {PROJECT_PHASE_LABELS[PROJECT_PHASES[selectedIdx + 1]]}
                  </strong>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
