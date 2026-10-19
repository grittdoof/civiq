// ═══════════════════════════════════════════════════════════════
// Bouton « retour » selon le parcours (logique pure).
// La navigation Next.js ne met pas à jour document.referrer : la page
// précédente est mémorisée en sessionStorage par NavigationTracker.
// ═══════════════════════════════════════════════════════════════

export const CLE_NAV_COURANT = "civiq:nav:courant";
export const CLE_NAV_PRECEDENT = "civiq:nav:precedent";
export const cleRetour = (portee: string) => `civiq:retour:${portee}`;

export interface Retour { href: string; label: string }

export const RETOUR_PROJETS: Retour = { href: "/admin/projects", label: "Tous les projets" };

const REGLES: Array<[RegExp, string]> = [
  [/^\/admin\/commissions\/[^/]+\/sessions\/[^/?]+/, "Retour à la séance"],
  [/^\/admin\/commissions\/[^/?]+/, "Retour à la commission"],
  [/^\/admin\/commissions(\?|$)/, "Retour aux commissions"],
  [/^\/admin\/calendrier/, "Retour au calendrier"],
  [/^\/admin\/tickets\/(?!nouveau)[^/?]+/, "Retour au signalement"],
  [/^\/admin\/tickets/, "Retour aux signalements"],
  [/^\/admin\/projects\/cartographie/, "Retour à la cartographie"],
  [/^\/admin\/projects\/comparatif/, "Retour au comparatif"],
  [/^\/admin\/projects\/revue-mensuelle/, "Retour à la revue mensuelle"],
  [/^\/admin\/projects\/ppi/, "Retour au PPI"],
  [/^\/admin\/projects\/financeurs/, "Retour aux financeurs"],
  [/^\/admin\/projects(\?|$)/, "Tous les projets"],
  [/^\/admin\/dashboard/, "Retour au tableau de bord"],
];

/** Page d'où l'on vient, telle que l'a vue le traceur (sans la page courante). */
export function pageDOrigine(courante: string, nav: { courant: string | null; precedent: string | null }): string | null {
  if (nav.courant && nav.courant !== courante) return nav.courant;
  return nav.precedent && nav.precedent !== courante ? nav.precedent : null;
}

/**
 * Retour proposé depuis une page de projet. `base` = chemin de la page
 * (ex. /admin/projects/<id>) : ses sous-pages ne sont jamais une origine.
 */
export function retourDepuis(origine: string | null, base: string): Retour | null {
  if (!origine || !origine.startsWith("/admin/")) return null;
  const chemin = origine.split("#")[0];
  if (chemin === base || chemin.startsWith(`${base}/`) || chemin.startsWith(`${base}?`)) return null;
  if (/^\/admin\/projects\/nouveau/.test(chemin)) return null;
  for (const [re, label] of REGLES) if (re.test(chemin)) return { href: chemin, label };
  return null;
}
