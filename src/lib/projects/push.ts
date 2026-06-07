// ═══════════════════════════════════════════════════════════════
// Stub minimal — l'implémentation push/email/SMS arrive au prochain
// commit. Les routes API importent en lazy ces helpers ; tant qu'ils
// ne font rien, les routes restent fonctionnelles (le push est
// best-effort et non bloquant, comme dans le module tickets).
// ═══════════════════════════════════════════════════════════════

import type { ProjectPhase, FinancingStatus } from "./types";

export async function notifyProjectPhaseChanged(_input: {
  projectId: string;
  fromPhase: ProjectPhase;
  toPhase: ProjectPhase;
  actorUserId: string;
}): Promise<void> {
  // implémenté au commit 6
}

export async function notifyFinancingStatusChange(_input: {
  projectId: string;
  financingId: string;
  financeur: string;
  newStatus: FinancingStatus;
}): Promise<void> {
  // implémenté au commit 6
}

export async function notifyMilestoneDue(_input: {
  projectId: string;
  milestoneId: string;
  libelle: string;
  echeance: string;
  daysToDue: number;
}): Promise<void> {
  // implémenté au commit 6
}

export async function notifyTicketTransformedToProject(_input: {
  projectId: string;
  ticketId: string;
  ticketNumero: number;
  pilotes: string[];
  ticketCreator: string | null;
}): Promise<void> {
  // implémenté au commit 6
}

export async function notifyCommissionConvocation(_input: {
  sessionId: string;
  commissionName: string;
  dateSeance: string;
  lieu: string | null;
  ordreDuJour: string | null;
  memberUserIds: string[];
}): Promise<void> {
  // implémenté au commit 6
}

export async function notifyCommissionMinutesValidated(_input: {
  sessionId: string;
  commissionName: string;
  memberUserIds: string[];
}): Promise<void> {
  // implémenté au commit 6
}
