// ═══════════════════════════════════════════════════════════════
// State-machine du module Gestion de projet
//
// Logique métier pure (sans accès BDD). Sert à :
//   • valider une transition côté UI avant d'appeler l'API
//   • produire des messages cohérents avec la RPC SQL
//     advance_project_phase() qui reste la source d'autorité
//
// MIGRATION 028 — Comportement révisé :
//   • Le projet a désormais un `type` (investment | event | tracking) ;
//     l'ordre des phases dépend du gabarit.
//   • Les anciennes règles bloquantes « porte de financement » et
//     « bilan obligatoire » deviennent des WARNINGS NON BLOQUANTS,
//     conformément au brief « portes indicatives, jamais bloquantes ».
//   • Ces warnings ne sont remontés que pour le gabarit investment.
//
// Règles encore bloquantes (opérationnel, pas métier) :
//   1. Rôle insuffisant
//   2. Transition vers la même phase
//   3. Phase cible étrangère au gabarit du projet
//   4. Recul sans commentaire
//   5. Saut > 1 étape (effective, hors phases NA) sans force+admin+commentaire
// ═══════════════════════════════════════════════════════════════

import {
  PROJECT_PHASES_BY_TYPE,
  SECURED_FINANCING_STATUSES,
  type FinancingStatus,
  type ProjectPhase,
  type ProjectType,
  type StakeholderRole,
  type StakeholderType,
} from "./types";

export interface ProjectSnapshot {
  /** Gabarit du projet — détermine l'ordre des phases. Default 'investment'. */
  type?: ProjectType;
  phase: ProjectPhase;
  sans_subvention: boolean;
  cout_reel: number | null;
  explication_ecart: string | null;
  financings: { statut: FinancingStatus }[];
  stakeholders: { role: StakeholderRole; type: StakeholderType }[];
  /** Phases marquées « non applicable ». Default {}. */
  phase_not_applicable?: Record<string, string>;
}

export interface UserContext {
  role: "super_admin" | "admin" | "editor" | "viewer" | null;
}

export type TransitionDirection = "forward" | "backward";

export interface TransitionDecision {
  ok: boolean;
  /** Raison du refus, ou message d'avertissement principal */
  reason?: string;
  /** Warnings non bloquants (à afficher avant confirmation) */
  warnings: string[];
  /** Sens de la transition si autorisée */
  direction?: TransitionDirection;
  /** L'appelant doit obligatoirement fournir un commentaire */
  require_comment: boolean;
  /** L'appelant doit cocher « forcer » + être admin */
  require_force: boolean;
}

const REFUSAL_JUMP =
  "Sauter une étape n'est pas autorisé. Utilisez « forcer » (admin uniquement) avec un commentaire.";
const REFUSAL_FORCE_ROLE = "Seul un administrateur peut forcer un saut d'étape.";
const REFUSAL_FORCE_COMMENT = "Un commentaire est obligatoire pour forcer une transition.";
const REFUSAL_BACK_COMMENT = "Un commentaire est obligatoire pour reculer d'étape.";
const REFUSAL_SAME = "Le projet est déjà à cette étape.";
const REFUSAL_ROLE = "Permissions insuffisantes pour faire évoluer le projet.";
const REFUSAL_FOREIGN_PHASE =
  "Cette phase n'appartient pas au gabarit du projet. Changez d'abord le type du projet pour utiliser cette phase.";

// Warnings (non bloquants — gabarit investment uniquement)
const WARN_FINANCING_NOT_SECURED =
  "Aucune subvention sécurisée et autofinancement non déclaré. Le risque d'irrégularité est élevé si vous notifiez un marché maintenant.";
const WARN_BILAN_INCOMPLETE =
  "Bilan incomplet : coût réel ou explication de l'écart manquants. La clôture reste possible mais le projet n'aura pas de bilan exploitable.";
const WARN_NO_DECIDE =
  "Aucune partie prenante avec le rôle « décide » n'est associée.";
const WARN_NO_FINANCEUR =
  "Aucune partie prenante de type « financeur » n'est associée.";

/** Retourne le gabarit auquel appartient une phase, ou null si inconnue. */
export function findPhaseType(phase: ProjectPhase): ProjectType | null {
  for (const t of Object.keys(PROJECT_PHASES_BY_TYPE) as ProjectType[]) {
    if (PROJECT_PHASES_BY_TYPE[t].includes(phase)) return t;
  }
  return null;
}

/** Position 0-indexée d'une phase dans son gabarit. Retourne -1 si absente. */
export function phasePosition(phase: ProjectPhase, type: ProjectType): number {
  return PROJECT_PHASES_BY_TYPE[type].indexOf(phase);
}

/** @deprecated Conservé pour rétrocompat tests. Suppose le gabarit investment. */
export function phaseIndex(p: ProjectPhase): number {
  return PROJECT_PHASES_BY_TYPE.investment.indexOf(p);
}

/**
 * Décide si une transition est autorisée. Pur — ne fait pas d'I/O.
 */
export function decideTransition(
  project: ProjectSnapshot,
  toPhase: ProjectPhase,
  user: UserContext,
  options: { force?: boolean; comment?: string } = {},
): TransitionDecision {
  const type: ProjectType = project.type ?? "investment";
  const order = PROJECT_PHASES_BY_TYPE[type];
  const fromIdx = order.indexOf(project.phase);
  const toIdx = order.indexOf(toPhase);

  // Rôle
  const allowedRoles = ["super_admin", "admin", "editor"] as const;
  if (!user.role || !allowedRoles.includes(user.role as (typeof allowedRoles)[number])) {
    return refused(REFUSAL_ROLE);
  }

  // Phase cible étrangère au gabarit
  if (toIdx < 0) {
    return refused(REFUSAL_FOREIGN_PHASE);
  }

  if (fromIdx === toIdx) return refused(REFUSAL_SAME);

  const step = toIdx - fromIdx;

  // ─── Recul ───
  if (step < 0) {
    if (!hasNonEmpty(options.comment)) {
      return {
        ok: false,
        reason: REFUSAL_BACK_COMMENT,
        warnings: [],
        require_comment: true,
        require_force: false,
        direction: "backward",
      };
    }
    return {
      ok: true,
      direction: "backward",
      warnings: [],
      require_comment: true,
      require_force: false,
    };
  }

  // Distance effective : on ne compte pas les phases marquées « non applicable »
  const naPhases = project.phase_not_applicable ?? {};
  let naBetween = 0;
  for (let i = fromIdx + 1; i < toIdx; i++) {
    if (Object.prototype.hasOwnProperty.call(naPhases, order[i])) {
      naBetween++;
    }
  }
  const effStep = step - naBetween;

  // ─── Saut > 1 étape effective ───
  if (effStep > 1) {
    if (!options.force) {
      return {
        ok: false,
        reason: REFUSAL_JUMP,
        warnings: [],
        require_comment: true,
        require_force: true,
        direction: "forward",
      };
    }
    if (!(user.role === "admin" || user.role === "super_admin")) {
      return refused(REFUSAL_FORCE_ROLE);
    }
    if (!hasNonEmpty(options.comment)) {
      return refused(REFUSAL_FORCE_COMMENT);
    }
  }

  // ─── Warnings métier (non bloquants — investment uniquement) ───
  const warnings: string[] = [];

  if (type === "investment") {
    // Porte de financement — n'est plus bloquante, juste un warning
    if (toPhase === "realisation") {
      const hasSecured = project.financings.some((f) =>
        SECURED_FINANCING_STATUSES.includes(f.statut),
      );
      if (!hasSecured && !project.sans_subvention) {
        warnings.push(WARN_FINANCING_NOT_SECURED);
      }
    }

    // Bilan — n'est plus bloquant, juste un warning
    if (toPhase === "bilan_cloture") {
      if (project.cout_reel === null || !hasNonEmpty(project.explication_ecart)) {
        warnings.push(WARN_BILAN_INCOMPLETE);
      }
    }

    if (toPhase === "decision_budget") {
      const hasDecide = project.stakeholders.some((s) => s.role === "decide");
      if (!hasDecide) warnings.push(WARN_NO_DECIDE);
    }

    if (toPhase === "financement") {
      const hasFinanceur = project.stakeholders.some((s) => s.type === "financeur");
      if (!hasFinanceur) warnings.push(WARN_NO_FINANCEUR);
    }
  }

  return {
    ok: true,
    direction: "forward",
    warnings,
    require_comment: effStep > 1,
    require_force: false,
  };
}

// ─── Helpers ───

function refused(reason: string): TransitionDecision {
  return {
    ok: false,
    reason,
    warnings: [],
    require_comment: false,
    require_force: false,
  };
}

function hasNonEmpty(s: string | null | undefined): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

// ─── Helpers de présentation ───

/** Phase suivante du gabarit. Si `type` non précisé, le déduit de la phase. */
export function nextPhase(
  phase: ProjectPhase,
  type?: ProjectType,
): ProjectPhase | null {
  const t = type ?? findPhaseType(phase);
  if (!t) return null;
  const order = PROJECT_PHASES_BY_TYPE[t];
  const i = order.indexOf(phase);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

/** Phase précédente du gabarit. Si `type` non précisé, le déduit de la phase. */
export function previousPhase(
  phase: ProjectPhase,
  type?: ProjectType,
): ProjectPhase | null {
  const t = type ?? findPhaseType(phase);
  if (!t) return null;
  const order = PROJECT_PHASES_BY_TYPE[t];
  const i = order.indexOf(phase);
  return i > 0 ? order[i - 1] : null;
}
