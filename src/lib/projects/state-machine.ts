// ═══════════════════════════════════════════════════════════════
// State-machine du module Gestion de projet
//
// Logique métier pure (sans accès BDD). Sert à :
//   • valider une transition côté UI avant d'appeler l'API
//   • produire des messages cohérents avec la RPC SQL
//     advance_project_phase() qui reste la source d'autorité
//
// Les règles couvertes :
//   1. Ordre canonique des 7 phases
//   2. Recul autorisé mais commentaire obligatoire
//   3. Saut > 1 étape interdit sauf si force=true + admin
//   4. Porte de financement : passage vers `realisation` bloqué
//      sauf si au moins un financing ar_recu/accordée/soldée
//      OU sans_subvention=true
//   5. Bilan obligatoire avant entrée dans `bilan_cloture` :
//      cout_reel ET explication_ecart renseignés
//   6. Warnings non bloquants à l'entrée de decision_budget
//      (pas de partie prenante « decide ») et de financement
//      (pas de partie prenante de type « financeur »)
// ═══════════════════════════════════════════════════════════════

import {
  PROJECT_PHASES,
  SECURED_FINANCING_STATUSES,
  type FinancingStatus,
  type ProjectPhase,
  type StakeholderRole,
  type StakeholderType,
} from "./types";

export interface ProjectSnapshot {
  phase: ProjectPhase;
  sans_subvention: boolean;
  cout_reel: number | null;
  explication_ecart: string | null;
  financings: { statut: FinancingStatus }[];
  stakeholders: { role: StakeholderRole; type: StakeholderType }[];
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

const REFUSAL_FINANCING =
  "Impossible de lancer la réalisation : aucune subvention n'a reçu d'accusé de réception et l'autofinancement n'a pas été déclaré. Demandez vos subventions avant tout commencement, ou cochez « sans subvention ».";

const REFUSAL_BILAN =
  "Bilan obligatoire avant clôture : renseignez le coût réel et l'explication de l'écart.";

const REFUSAL_JUMP =
  "Sauter une étape n'est pas autorisé. Utilisez « forcer » (admin uniquement) avec un commentaire.";

const REFUSAL_FORCE_ROLE =
  "Seul un administrateur peut forcer un saut d'étape.";

const REFUSAL_FORCE_COMMENT =
  "Un commentaire est obligatoire pour forcer une transition.";

const REFUSAL_BACK_COMMENT =
  "Un commentaire est obligatoire pour reculer d'étape.";

const REFUSAL_SAME = "Le projet est déjà à cette étape.";

const REFUSAL_ROLE =
  "Permissions insuffisantes pour faire évoluer le projet.";

export function phaseIndex(p: ProjectPhase): number {
  return PROJECT_PHASES.indexOf(p);
}

/**
 * Décide si une transition est autorisée. Pur — ne fait pas d'I/O.
 *
 * @param project  Snapshot du projet (phase, financings, bilan, parties prenantes)
 * @param toPhase  Phase cible
 * @param user     Rôle de l'utilisateur courant
 * @param options  { force, comment } — l'UI peut pré-fournir ces valeurs
 */
export function decideTransition(
  project: ProjectSnapshot,
  toPhase: ProjectPhase,
  user: UserContext,
  options: { force?: boolean; comment?: string } = {},
): TransitionDecision {
  const fromIdx = phaseIndex(project.phase);
  const toIdx = phaseIndex(toPhase);
  const step = toIdx - fromIdx;

  // Rôle
  const allowedRoles = ["super_admin", "admin", "editor"] as const;
  if (!user.role || !allowedRoles.includes(user.role as (typeof allowedRoles)[number])) {
    return refused(REFUSAL_ROLE);
  }

  if (step === 0) return refused(REFUSAL_SAME);

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

  // ─── Saut d'étape ───
  if (step > 1) {
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
    // Même en forçant, on doit toujours respecter la porte
    // de financement et le bilan obligatoire. La règle de saut
    // est la seule contournée par force.
  }

  // ─── Porte de financement (vers realisation) ───
  if (toPhase === "realisation") {
    const hasSecured = project.financings.some((f) =>
      SECURED_FINANCING_STATUSES.includes(f.statut),
    );
    if (!hasSecured && !project.sans_subvention) {
      return refused(REFUSAL_FINANCING);
    }
  }

  // ─── Bilan obligatoire (vers bilan_cloture) ───
  if (toPhase === "bilan_cloture") {
    if (project.cout_reel === null || !hasNonEmpty(project.explication_ecart)) {
      return refused(REFUSAL_BILAN);
    }
  }

  // ─── Warnings non bloquants ───
  const warnings: string[] = [];

  if (toPhase === "decision_budget") {
    const hasDecide = project.stakeholders.some((s) => s.role === "decide");
    if (!hasDecide) {
      warnings.push(
        "Aucune partie prenante avec le rôle « décide » n'est associée.",
      );
    }
  }

  if (toPhase === "financement") {
    const hasFinanceur = project.stakeholders.some((s) => s.type === "financeur");
    if (!hasFinanceur) {
      warnings.push(
        "Aucune partie prenante de type « financeur » n'est associée.",
      );
    }
  }

  return {
    ok: true,
    direction: "forward",
    warnings,
    require_comment: step > 1, // saut forcé → commentaire déjà fourni
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

export function nextPhase(phase: ProjectPhase): ProjectPhase | null {
  const i = phaseIndex(phase);
  return i >= 0 && i < PROJECT_PHASES.length - 1 ? PROJECT_PHASES[i + 1] : null;
}

export function previousPhase(phase: ProjectPhase): ProjectPhase | null {
  const i = phaseIndex(phase);
  return i > 0 ? PROJECT_PHASES[i - 1] : null;
}
