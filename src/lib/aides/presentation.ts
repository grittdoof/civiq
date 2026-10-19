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

// ─── Informations conservées sur une demande créée depuis une aide (migration 053) ───

export interface InfosAide {
  description?: string | null;
  categories?: string[];
  types_aide?: string[];
  financeurs?: string[];
  perimetre?: string | null;
  recurrence?: string | null;
  appel_a_projets?: boolean;
}

export interface AideSource {
  url: string | null;
  url_candidature?: string | null;
  date_limite: string | null;
  description?: string | null;
  categories: string[];
  types_aide?: string[];
  financeurs: string[];
  perimetre?: string | null;
  recurrence?: string | null;
  appel_a_projets?: boolean;
}

/** Champs copiés sur la demande de subvention à sa création. */
export function infosAideDepuis(a: AideSource) {
  return {
    aide_url: a.url,
    aide_url_candidature: a.url_candidature ?? null,
    aide_date_limite: a.date_limite,
    aide_infos: {
      description: a.description ?? null,
      categories: a.categories,
      types_aide: a.types_aide ?? [],
      financeurs: a.financeurs,
      perimetre: a.perimetre ?? null,
      recurrence: a.recurrence ?? null,
      appel_a_projets: a.appel_a_projets ?? false,
    } satisfies InfosAide,
  };
}

const textes = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 200)).slice(0, max) : [];
const texte = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Lecture tolérante et bornée des informations d'aide reçues du client. */
export function lireInfosAide(v: unknown): InfosAide | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  return {
    description: texte(o.description, 1200),
    categories: textes(o.categories, 12),
    types_aide: textes(o.types_aide, 8),
    financeurs: textes(o.financeurs, 8),
    perimetre: texte(o.perimetre, 200),
    recurrence: texte(o.recurrence, 100),
    appel_a_projets: o.appel_a_projets === true,
  };
}
