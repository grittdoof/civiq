// ═══════════════════════════════════════════════════════════════
// Aides-territoires & alerte de campagne — logique pure (lot D).
//
// API publique de l'ANCT / DGALN (≈ 3 000 dispositifs, 600 organismes).
// Données sous Licence Ouverte v2.0 (Etalab) : toujours citer la source
// et la date de mise à jour.
//
// Deux interdits absolus (brief §2.9) :
//   1. jamais de montant d'aide estimé ni de taux prévisionnel ;
//   2. jamais présenter une suggestion comme une éligibilité.
// ═══════════════════════════════════════════════════════════════

export const ATTRIBUTION = {
  source: "Aides-territoires",
  editeur: "Agence nationale de la cohésion des territoires (ANCT)",
  licence: "Licence Ouverte v2.0 (Etalab)",
  url: "https://aides-territoires.beta.gouv.fr",
};

export const AVERTISSEMENT_SUGGESTION =
  "Piste à explorer — l'éligibilité dépend de critères que seul le financeur peut confirmer.";

// ─── Normalisation d'une aide renvoyée par l'API ───
// Le format exact n'étant pas contractuel (API « en construction
// active »), la lecture est tolérante : champs manquants ⇒ null.

export interface AideCache {
  aide_id: string;
  nom: string;
  slug: string | null;
  url: string | null;
  url_candidature: string | null;
  financeurs: string[];
  categories: string[];
  types_aide: string[];
  description: string | null;
  date_ouverture: string | null;
  date_limite: string | null;
  recurrence: string | null;
  appel_a_projets: boolean;
  perimetre: string | null;
  source_maj: string | null;
}

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const date = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
/** Liste de libellés depuis ["a", "b"] ou [{name: "a"}, …]. */
function names(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? str((x as Raw).name) ?? str((x as Raw).label) : null))
    .filter((x): x is string => !!x);
}
function stripHtml(s: string | null): string | null {
  if (!s) return null;
  const t = s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 2000) : null;
}

export function normaliserAide(raw: Raw, baseUrl = ATTRIBUTION.url): AideCache | null {
  const id = str(raw.id) ?? str(raw.slug);
  const nom = str(raw.name) ?? str(raw.name_initial) ?? str(raw.short_title);
  if (!id || !nom) return null;
  const slug = str(raw.slug);
  const perimeter = raw.perimeter;
  const recurrence = raw.recurrence ?? raw.aid_recurrence;
  return {
    aide_id: id,
    nom,
    slug,
    url: str(raw.url) ?? (slug ? `${baseUrl}/aides/${slug}/` : null),
    url_candidature: str(raw.application_url) ?? str(raw.origin_url),
    financeurs: names(raw.financers ?? raw.financers_full ?? raw.backers),
    categories: names(raw.categories ?? raw.categories_full),
    types_aide: names(raw.aid_types ?? raw.aid_types_full),
    description: stripHtml(str(raw.description)),
    date_ouverture: date(raw.start_date ?? raw.date_start),
    date_limite: date(raw.submission_deadline ?? raw.date_submission_deadline),
    recurrence: typeof recurrence === "string" ? recurrence : recurrence && typeof recurrence === "object" ? str((recurrence as Raw).name) : null,
    appel_a_projets: raw.is_call_for_project === true,
    perimetre: typeof perimeter === "string" ? perimeter : perimeter && typeof perimeter === "object" ? str((perimeter as Raw).name) : null,
    source_maj: str(raw.date_updated) ?? str(raw.time_update),
  };
}

/** Page de résultats : { results, next } (DRF) ou { hydra:member, hydra:view } (API Platform) ou tableau. */
export function lirePage(json: unknown): { items: Raw[]; next: string | null } {
  if (Array.isArray(json)) return { items: json as Raw[], next: null };
  const j = (json ?? {}) as Raw;
  const items = (j.results ?? j["hydra:member"] ?? j.items ?? []) as Raw[];
  const view = (j["hydra:view"] ?? {}) as Raw;
  const next = str(j.next) ?? str(view["hydra:next"]);
  return { items: Array.isArray(items) ? items : [], next };
}

// ─── Suggestions pour un projet ───

const STOP = new Set(
  "de du des la le les un une et en au aux pour sur dans par avec a l d projet commune communal communale travaux amenagement rue salle".split(" "),
);
function mots(s: string): string[] {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    // Pluriel ramené au singulier (clochers → clocher, églises → eglise).
    .map((w) => (w.length > 4 && /[sx]$/.test(w) ? w.slice(0, -1) : w))
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

export interface Suggestion extends AideCache {
  score: number;
}

/**
 * 3 à 5 pistes pour un projet : aides dont la date limite n'est pas
 * passée, classées par pertinence (mots du titre et de la description
 * retrouvés dans le nom, les thématiques ou la description de l'aide),
 * puis par date limite la plus proche. Aucune note ni montant exposé.
 */
export function suggererAides(
  aides: AideCache[],
  projet: { titre: string; description?: string | null },
  aujourdhui: string,
  max = 5,
): Suggestion[] {
  const cles = new Set(mots(`${projet.titre} ${projet.description ?? ""}`));
  if (cles.size === 0) return [];
  return aides
    .filter((a) => !a.date_limite || a.date_limite >= aujourdhui)
    .map((a) => {
      const nom = new Set(mots(a.nom));
      const cat = new Set(mots(a.categories.join(" ")));
      const desc = new Set(mots(a.description ?? ""));
      let score = 0;
      for (const c of cles) {
        if (nom.has(c)) score += 3;
        if (cat.has(c)) score += 2;
        if (desc.has(c)) score += 1;
      }
      return { ...a, score };
    })
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score || (a.date_limite ?? "9999").localeCompare(b.date_limite ?? "9999"))
    .slice(0, max);
}

// ─── Alerte de campagne (DETR / DSIL) ───
// Tâche mensuelle : de septembre à décembre, repère les investissements
// prévus l'année suivante sans aucune demande de subvention déposée.

export const MOIS_CAMPAGNE = [8, 9, 10, 11]; // septembre → décembre (getUTCMonth)

export function campagneActive(now: Date): boolean {
  return MOIS_CAMPAGNE.includes(now.getUTCMonth());
}

export interface ProjetCampagne {
  id: string;
  titre: string;
  type_code: string | null;
  echeance_souhaitee: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  autofinancement_assume?: boolean;
}

const DEPOSEES = new Set(["demandee", "ar_recu", "accordee", "soldee"]);

/** Investissements prévus en `annee` sans demande déposée (ni autofinancement assumé). */
export function projetsSansDemande(
  projets: ProjetCampagne[],
  financements: Array<{ project_id: string; statut: string }>,
  annee: number,
): ProjetCampagne[] {
  const avecDemande = new Set(financements.filter((f) => DEPOSEES.has(f.statut)).map((f) => f.project_id));
  return projets.filter(
    (p) =>
      p.type_code === "investissement" &&
      !p.archived_at && !p.deleted_at && !p.autofinancement_assume &&
      p.echeance_souhaitee?.slice(0, 4) === String(annee) &&
      !avecDemande.has(p.id),
  );
}

export function messageCampagne(n: number, annee: number) {
  return {
    constat: `${n === 1 ? "1 projet d'investissement prévu" : `${n} projets d'investissement prévus`} en ${annee} ${n === 1 ? "n'a" : "n'ont"} aucune demande de subvention déposée.`,
    consequence:
      "La campagne de la dotation d'équipement des territoires ruraux (DETR) et de la dotation de soutien à l'investissement local (DSIL) se dépose à l'automne de l'année précédente. Passé les dates limites, il faudra attendre un an.",
    actions: ["Voir les projets concernés et préparer les dossiers avec la secrétaire de mairie."],
    enSavoirPlus: [
      "Les dates limites sont fixées chaque année par la préfecture : en général fin novembre pour les demandes supérieures à 50 000 €, fin décembre en dessous. Vérifiez l'appel à projets de votre préfecture.",
    ],
  };
}
