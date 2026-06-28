"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_GUIDE,
  type ProjectPhase,
} from "@/lib/projects/types";
import PhaseIcon from "./PhaseIcon";

// ═══════════════════════════════════════════════════════════════
// PhaseRail — fusion du stepper et de l'ancien PhaseGuide.
//
// Compact, sticky en haut du PhaseWorkspace.
//   - Mobile : barre fine (40 px) avec icône + label + barre de
//     progression. Tap → bottom-sheet avec les 7 phases.
//   - Desktop : 7 pills horizontales cliquables avec compteur
//     livrables (X/N) sous chacune et indicateur de phase
//     courante (pulse).
//
// La navigation se fait via Link → /admin/projects/[id]/phase/[phase]
// pour permettre prefetch + transitions Server Component.
// ═══════════════════════════════════════════════════════════════

type ProgressMap = Record<
  string,
  Record<string, { done: boolean; note: string | null }>
>;

interface ResourceCounts {
  documents: number;
  stakeholders: number;
  financings: number;
  milestones: number;
}

interface Props {
  projectId: string;
  /** Phase actuelle du projet (sa vraie phase BDD). */
  currentPhase: ProjectPhase;
  /** Phase affichée à l'écran (peut différer pour la consultation). */
  focusedPhase: ProjectPhase;
  progress: ProgressMap;
  resourceCounts: ResourceCounts;
}

export default function PhaseRail({
  projectId,
  currentPhase,
  focusedPhase,
  progress,
  resourceCounts,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Échap pour fermer la bottom-sheet
  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSheetOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const currentIdx = PROJECT_PHASES.indexOf(currentPhase);
  const focusedIdx = PROJECT_PHASES.indexOf(focusedPhase);

  function deliverableDone(
    phase: ProjectPhase,
    idx: number,
    kind: string,
  ): boolean {
    const manual = progress[phase]?.[String(idx)]?.done === true;
    if (manual) return true;
    if (kind === "document" && resourceCounts.documents > 0) return true;
    if (kind === "stakeholder" && resourceCounts.stakeholders > 0) return true;
    if (kind === "financing" && resourceCounts.financings > 0) return true;
    if (kind === "milestone" && resourceCounts.milestones > 0) return true;
    return false;
  }

  function phaseProgress(phase: ProjectPhase) {
    const deliverables = PROJECT_PHASE_GUIDE[phase].deliverables;
    const done = deliverables.reduce(
      (n, d, i) => (deliverableDone(phase, i, d.kind) ? n + 1 : n),
      0,
    );
    return { done, total: deliverables.length };
  }

  // Pourcentage global du projet (moyenne pondérée — phases en cours
  // ou passées comptent à plein)
  const globalPct = (() => {
    const total = PROJECT_PHASES.reduce(
      (n, p) => n + PROJECT_PHASE_GUIDE[p].deliverables.length,
      0,
    );
    const done = PROJECT_PHASES.reduce((n, p) => {
      return (
        n +
        PROJECT_PHASE_GUIDE[p].deliverables.reduce(
          (m, d, i) => (deliverableDone(p, i, d.kind) ? m + 1 : m),
          0,
        )
      );
    }, 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  })();

  const focusedProgress = phaseProgress(focusedPhase);

  return (
    <>
      {/* ─── Mobile (barre compacte) ─── */}
      <button
        type="button"
        className="pj-rail-mobile"
        onClick={() => setSheetOpen(true)}
        aria-label="Choisir une phase"
      >
        <span className="pj-rail-mobile-icon" aria-hidden>
          <PhaseIcon phase={focusedPhase} size={14} strokeWidth={2} />
        </span>
        <span className="pj-rail-mobile-label">
          <span className="pj-rail-mobile-num">{focusedIdx + 1}/7</span>
          {PROJECT_PHASE_LABELS[focusedPhase]}
        </span>
        <span className="pj-rail-mobile-pct">{globalPct}%</span>
        <span className="pj-rail-mobile-bar" aria-hidden>
          <span
            className="pj-rail-mobile-bar-fill"
            style={{ width: `${globalPct}%` }}
          />
        </span>
      </button>

      {/* ─── Desktop (7 pills horizontales) ─── */}
      <nav className="pj-rail-desktop" aria-label="Phases du projet">
        {PROJECT_PHASES.map((phase, i) => {
          const isFocused = phase === focusedPhase;
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          const pp = phaseProgress(phase);
          return (
            <Link
              key={phase}
              href={`/admin/projects/${projectId}/phase/${phase}`}
              className={`pj-rail-pill${isFocused ? " is-focused" : ""}${
                isCurrent ? " is-current" : ""
              }${isPast ? " is-past" : ""}`}
              prefetch={false}
            >
              <span className="pj-rail-pill-icon" aria-hidden>
                {isPast ? (
                  <CheckCircle2 size={13} />
                ) : isCurrent ? (
                  <span className="pj-rail-pill-pulse" />
                ) : (
                  <Circle size={13} />
                )}
              </span>
              <span className="pj-rail-pill-num">{i + 1}</span>
              <span className="pj-rail-pill-label">
                {PROJECT_PHASE_LABELS[phase]}
              </span>
              {pp.total > 0 && (
                <span className="pj-rail-pill-progress">
                  {pp.done}/{pp.total}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ─── Bottom-sheet mobile (picker de phase) ─── */}
      {sheetOpen && (
        <div
          className="pj-rail-sheet-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div
            ref={sheetRef}
            className="pj-rail-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Choisir une phase"
          >
            <header className="pj-rail-sheet-head">
              <h2 className="pj-rail-sheet-title">Phases du projet</h2>
              <button
                type="button"
                className="pj-rail-sheet-close"
                onClick={() => setSheetOpen(false)}
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </header>
            <div className="pj-rail-sheet-progress">
              <span>Avancement global</span>
              <strong>{globalPct}%</strong>
            </div>
            <ul className="pj-rail-sheet-list">
              {PROJECT_PHASES.map((phase, i) => {
                const isFocused = phase === focusedPhase;
                const isCurrent = i === currentIdx;
                const isPast = i < currentIdx;
                const pp = phaseProgress(phase);
                return (
                  <li key={phase}>
                    <Link
                      href={`/admin/projects/${projectId}/phase/${phase}`}
                      onClick={() => setSheetOpen(false)}
                      className={`pj-rail-sheet-item${
                        isFocused ? " is-focused" : ""
                      }${isCurrent ? " is-current" : ""}${
                        isPast ? " is-past" : ""
                      }`}
                      prefetch={false}
                    >
                      <span className="pj-rail-sheet-item-num">{i + 1}</span>
                      <span className="pj-rail-sheet-item-icon" aria-hidden>
                        <PhaseIcon phase={phase} size={16} strokeWidth={2} />
                      </span>
                      <span className="pj-rail-sheet-item-label">
                        {PROJECT_PHASE_LABELS[phase]}
                      </span>
                      <span className="pj-rail-sheet-item-state" aria-hidden>
                        {isPast ? (
                          <CheckCircle2 size={16} />
                        ) : isCurrent ? (
                          <span className="pj-rail-pill-pulse" />
                        ) : (
                          <Circle size={16} />
                        )}
                      </span>
                      {pp.total > 0 && (
                        <span className="pj-rail-sheet-item-progress">
                          {pp.done}/{pp.total}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <footer className="pj-rail-sheet-foot">
              Phase actuelle :{" "}
              <strong>{PROJECT_PHASE_LABELS[focusedPhase]}</strong> ·{" "}
              {focusedProgress.done}/{focusedProgress.total} livrables
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
