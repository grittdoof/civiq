// ═══════════════════════════════════════════════════════════════
// Passerelle signalement → projet (lot G) — logique pure.
//
// Lien unique : `tickets.project_id` fait foi (posé par la RPC
// create_project_from_wizard, qui passe aussi le signalement au statut
// « converti_en_projet »). `projects.source_ticket_id` n'est plus lu
// que pour l'historique.
// ═══════════════════════════════════════════════════════════════

export interface SignalementLien {
  statut: string;
  project_id: string | null;
}

export interface ProjetLie {
  id: string;
  titre: string;
  deleted_at: string | null;
}

export type EtatPasserelle =
  /** Aucun projet : le bouton « Transformer en projet » est proposé. */
  | { kind: "convertible" }
  /** Projet visible du spectateur. */
  | { kind: "lie"; projetId: string; titre: string; corbeille: boolean }
  /** Projet confidentiel : on dit qu'il existe, sans titre ni lien. */
  | { kind: "lie_confidentiel" }
  /** Converti, mais le projet a été définitivement supprimé : le signalement peut être rouvert. */
  | { kind: "projet_supprime" };

export function etatPasserelle(
  t: SignalementLien,
  projet: ProjetLie | null,
  visible: boolean,
): EtatPasserelle {
  if (t.project_id && projet) {
    if (!visible) return { kind: "lie_confidentiel" };
    return { kind: "lie", projetId: projet.id, titre: projet.titre, corbeille: !!projet.deleted_at };
  }
  if (t.statut === "converti_en_projet") return { kind: "projet_supprime" };
  return { kind: "convertible" };
}

/** Tant que le projet existe, le signalement est verrouillé (ni statut, ni réouverture). */
export const verrouilleParProjet = (t: SignalementLien) => !!t.project_id;

/** Adresse de l'assistant de création, prérempli depuis le signalement. */
export const lienConversion = (ticketId: string) =>
  `/admin/projects/nouveau?from_ticket=${encodeURIComponent(ticketId)}`;

/** Message d'erreur lisible pour un refus de la RPC. */
export function erreurConversion(message: string | null | undefined): string | null {
  if (!message) return null;
  if (message.includes("déjà rattaché à un projet")) return "Ce signalement est déjà rattaché à un projet.";
  if (message.includes("Ticket introuvable")) return "Ce signalement est introuvable.";
  return null;
}
