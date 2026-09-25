// ═══════════════════════════════════════════════════════════════
// Suppression logique (migration 036).
//
// Les données du module (projets, étapes, devis, délibérations, pièces
// jointes, séances…) sont des archives publiques : on ne fait jamais de
// DELETE physique. Les lignes sont marquées deleted_at / deleted_by et
// toutes les lectures filtrent `.is("deleted_at", null)`.
// Les fichiers Storage associés ne sont PAS supprimés.
// ═══════════════════════════════════════════════════════════════

export function softDeleteFields(userId: string | null | undefined) {
  return { deleted_at: new Date().toISOString(), deleted_by: userId || null };
}

/** Code Postgres « foreign_key_violation » : la ligne a un historique. */
export const FK_VIOLATION = "23503";
