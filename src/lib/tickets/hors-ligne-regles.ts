// Règles pures du mode hors ligne (lot 3), testées.

/**
 * Erreur due au réseau (à réessayer plus tard) plutôt qu'un refus du
 * serveur (droits, validation : inutile de réessayer tel quel).
 */
export function estErreurReseau(e: unknown, enLigne: boolean): boolean {
  if (!enLigne) return true;
  if (e instanceof TypeError) return true; // fetch : « Failed to fetch », « Load failed »
  const msg = e instanceof Error ? e.message.toLowerCase() : "";
  return /failed to fetch|load failed|network|réseau|timeout|fetch failed|networkerror/.test(msg);
}

/** Libellé du bandeau : « 2 signalements en attente d'envoi ». */
export function libelleFile(nb: number, enLigne: boolean): string | null {
  if (nb === 0) return enLigne ? null : "Pas de réseau : les signalements créés seront envoyés au retour de la connexion.";
  const s = nb > 1 ? "s" : "";
  return enLigne
    ? `${nb} signalement${s} en attente d'envoi`
    : `${nb} signalement${s} en attente : envoi automatique au retour du réseau`;
}
