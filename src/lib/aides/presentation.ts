// ═══════════════════════════════════════════════════════════════
// Présentation des pistes de financement (Aides-territoires) — pur.
// Thématiques en étiquettes courtes et colorées par famille, tri par
// date limite, échéance proche signalée.
// ═══════════════════════════════════════════════════════════════

export type FamilleTheme = "mobilite" | "amenagement" | "transition" | "social" | "autre";

const FAMILLES: Array<[RegExp, FamilleTheme]> = [
  [/mobilit|transport|v[ée]lo|cyclable/i, "mobilite"],
  [/urbanisme|logement|am[ée]nagement|voirie|r[ée]seaux|b[âa]timent|patrimoine|r[ée]habilitation/i, "amenagement"],
  [/[ée]nergi|climat|nature|environnement|biodiversit|eau|d[ée]chet|transition|risque/i, "transition"],
  [/solidarit|social|sant[ée]|culture|sport|loisir|jeunesse|[ée]ducation|enfance/i, "social"],
];

export function familleDe(theme: string): FamilleTheme {
  for (const [re, f] of FAMILLES) if (re.test(theme)) return f;
  return "autre";
}

/**
 * « Urbanisme / logement / aménagement / Voirie et réseaux » → étiquette
 * « Voirie et réseaux », colorée d'après le thème complet. Sans doublon.
 */
export function etiquettesCategories(categories: string[], max = 2): Array<{ label: string; famille: FamilleTheme }> {
  const out: Array<{ label: string; famille: FamilleTheme }> = [];
  for (const c of categories) {
    const parts = c.split(" / ").map((p) => p.trim()).filter(Boolean);
    const label = parts[parts.length - 1] ?? c;
    if (!label || out.some((o) => o.label === label)) continue;
    out.push({ label, famille: familleDe(c) });
    if (out.length >= max) break;
  }
  return out;
}

/** Date limite d'abord (la plus proche en tête), puis « au fil de l'eau ». Stable. */
export function trierParDateLimite<T extends { date_limite: string | null }>(aides: T[]): T[] {
  return aides
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      const dx = x.a.date_limite, dy = y.a.date_limite;
      if (dx && dy) return dx.localeCompare(dy) || x.i - y.i;
      if (dx) return -1;
      if (dy) return 1;
      return x.i - y.i;
    })
    .map((x) => x.a);
}

/** Échéance à moins de `jours` jours (mise en avant). */
export function echeanceProche(dateLimite: string | null, aujourdhui: string, jours = 90): boolean {
  if (!dateLimite) return false;
  const ecart = (Date.parse(`${dateLimite}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / 86_400_000;
  return ecart >= 0 && ecart <= jours;
}

export const libelleDateLimite = (d: string) =>
  `Avant le ${new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}`;
