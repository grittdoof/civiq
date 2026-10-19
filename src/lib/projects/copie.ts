// ═══════════════════════════════════════════════════════════════
// Secrétariat / agents en copie des emails de la plateforme
// (convocations, comptes rendus, étapes envoyées) — logique pure.
//
// Liste de la commune (commune_settings.copie_emails), remplaçable
// commission par commission (commissions.copie_emails : NULL = liste
// de la commune ; tableau, même vide = liste propre à la commission).
// ═══════════════════════════════════════════════════════════════

import { validerDestinataires } from "./envoi-etape";

export const MAX_COPIE = 10;

/** Liste saisie (tableau, ou texte séparé par virgules, points-virgules, retours à la ligne). */
export function lireListeEmails(v: unknown): { valides: string[]; invalides: string[] } {
  const brut = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,;]+/) : [];
  return validerDestinataires(brut.filter((x) => typeof x === "string" && x.trim()));
}

/** Liste applicable à une commission. */
export function listeCopie(commune: string[] | null | undefined, commission: string[] | null | undefined): string[] {
  return [...new Set((commission ?? commune ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/** Adresses en copie qui ne sont pas déjà destinataires. */
export function copieSans(copie: string[], destinataires: string[]): string[] {
  const deja = new Set(destinataires.map((e) => e.trim().toLowerCase()));
  return copie.filter((e) => !deja.has(e));
}
