// ═══════════════════════════════════════════════════════════════
// Utilitaires de texte pour le module projets.
// ═══════════════════════════════════════════════════════════════

/** Strip basique des balises HTML (suffisant pour l'extraction
 *  d'un aperçu textuel ; le HTML rentrant est déjà sanitizé par
 *  sanitizeRichText avec une whitelist très restreinte). */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    // Convertit <br>, </p>, </li>, etc. en espaces pour ne pas coller les mots
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|h[1-6]|ul|ol|div)>/gi, " ")
    // Strip toutes les balises restantes
    .replace(/<[^>]+>/g, "")
    // Décode quelques entités HTML communes
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/** Tronque une chaîne à `maxChars` caractères (au mot le plus proche
 *  si possible) et ajoute « … » si tronquée. */
export function truncate(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  // On essaie de couper au dernier espace pour ne pas casser un mot
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + "…";
}

/** Extrait un aperçu de N caractères depuis un texte HTML rich. */
export function extractExcerpt(html: string | null | undefined, maxChars = 80): string {
  return truncate(htmlToPlainText(html), maxChars);
}
