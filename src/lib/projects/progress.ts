// ═══════════════════════════════════════════════════════════════
// Calcul de progression d'une phase
//
// Logique pure et partagée entre :
//   • la page liste des livrables d'une phase
//   • DeliverablePage (focus sur un livrable)
//   • la route PDF
//   • la page portefeuille (résumé)
//
// Migration 028 — chaque entrée de phase_progress peut désormais
// porter `applicable: boolean` (default true). Les livrables non
// applicables sortent du périmètre obligatoire — ils ne comptent
// ni dans le total ni dans le « fait ».
// ═══════════════════════════════════════════════════════════════

import type {
  DeliverableKind,
  DeliverableSpec,
  ProjectPhase,
} from "./types";

export interface DeliverableProgressEntry {
  done: boolean;
  note: string | null;
  /** Default true. Si false, le livrable est exclu du périmètre obligatoire. */
  applicable?: boolean;
}

/** Format complet du jsonb projects.phase_progress. */
export type PhaseProgress = Record<
  string,
  Record<string, DeliverableProgressEntry>
>;

/** Snapshot minimal du projet pour évaluer l'auto-cochage. */
export interface ProjectFieldsForProgress {
  titre: string;
  pilote_elu: string | null;
  pilote_agent: string | null;
  budget_estime: number;
  cout_reel: number | null;
  explication_ecart: string | null;
}

export interface ResourceCounts {
  documents: number;
  stakeholders: number;
  financings: number;
  milestones: number;
}

export interface DeliverableState {
  done: boolean;
  applicable: boolean;
  note: string | null;
}

/** Lit l'entrée brute (peut être absente / partielle). */
export function readEntry(
  progress: PhaseProgress | null | undefined,
  phase: ProjectPhase,
  idx: number,
): DeliverableProgressEntry {
  return (
    progress?.[phase]?.[String(idx)] ?? { done: false, note: null }
  );
}

/** Calcule l'état d'un livrable (auto-coche selon le kind + applicable). */
export function computeDeliverableState(
  progress: PhaseProgress | null | undefined,
  phase: ProjectPhase,
  idx: number,
  spec: DeliverableSpec,
  project: ProjectFieldsForProgress,
  counts: ResourceCounts,
): DeliverableState {
  const entry = readEntry(progress, phase, idx);
  const applicable = entry.applicable !== false;
  let done = entry.done;

  // Auto-cochage par kind (sauf si non applicable — peu importe alors).
  if (applicable && !done) {
    done = isAutoDone(spec.kind, project, counts);
  }

  return { done, applicable, note: entry.note };
}

function isAutoDone(
  kind: DeliverableKind,
  project: ProjectFieldsForProgress,
  counts: ResourceCounts,
): boolean {
  switch (kind) {
    case "identity":
      return Boolean(project.titre && project.titre !== "Sans titre");
    case "document":
      return counts.documents > 0;
    case "stakeholder":
      return counts.stakeholders > 0;
    case "financing":
      return counts.financings > 0;
    case "milestone":
      return counts.milestones > 0;
    default:
      return false;
  }
}

export interface PhaseProgressSummary {
  /** Livrables obligatoires (non-optional, applicable) — base du pct. */
  total: number;
  /** Faits parmi les obligatoires. */
  done: number;
  /** Pourcentage 0..100. 100 si total=0. */
  pct: number;
  /** Index du premier livrable obligatoire non fait, ou -1. */
  firstTodoIdx: number;
}

/** Calcule le résumé de progression d'une phase entière. */
export function computePhaseProgress(
  progress: PhaseProgress | null | undefined,
  phase: ProjectPhase,
  deliverables: DeliverableSpec[],
  project: ProjectFieldsForProgress,
  counts: ResourceCounts,
): PhaseProgressSummary {
  let total = 0;
  let done = 0;
  let firstTodoIdx = -1;

  deliverables.forEach((spec, idx) => {
    const state = computeDeliverableState(progress, phase, idx, spec, project, counts);
    // Seuls les livrables OBLIGATOIRES et APPLICABLES entrent dans le périmètre.
    if (spec.optional || !state.applicable) return;
    total += 1;
    if (state.done) done += 1;
    else if (firstTodoIdx < 0) firstTodoIdx = idx;
  });

  return {
    total,
    done,
    pct: total > 0 ? Math.round((done / total) * 100) : 100,
    firstTodoIdx,
  };
}
