// ═══════════════════════════════════════════════════════════════
// Paramètres « projets » d'une commune (table commune_settings,
// migration 037). Validation pure, partagée API ↔ tests.
//
//   A. Délégation du conseil au maire (art. L.2122-22 4° CGCT)
//   B. Guide interne des achats (désactivé par défaut)
//   C. Taux FCTVA, code INSEE
// ═══════════════════════════════════════════════════════════════

export interface CommuneParametres {
  commune_id: string;
  seuil_delegation_maire_ht: number | null;
  delegation_deliberation_num: string | null;
  delegation_deliberation_date: string | null;
  regles_internes_actives: boolean;
  nb_devis_exige: number;
  seuil_devis_exige_ht: number;
  taux_fctva: number;
  code_insee: string | null;
  taux_inflation: number;
  taux_actualisation: number;
  updated_at: string | null;
}

export const DEFAULT_PARAMETRES: Omit<CommuneParametres, "commune_id"> = {
  seuil_delegation_maire_ht: null,
  delegation_deliberation_num: null,
  delegation_deliberation_date: null,
  regles_internes_actives: false,
  nb_devis_exige: 3,
  seuil_devis_exige_ht: 5000,
  taux_fctva: 16.404,
  code_insee: null,
  taux_inflation: 2,
  taux_actualisation: 4,
  updated_at: null,
};

export type ParametresPatch = Partial<Omit<CommuneParametres, "commune_id" | "updated_at">>;

export type ValidationResult =
  | { ok: true; updates: ParametresPatch }
  | { ok: false; errors: Record<string, string> };

const INSEE_RE = /^([0-9]{5}|2[AB][0-9]{3})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function toText(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = String(v).trim();
  return t ? t : null;
}

/**
 * Valide un PATCH partiel. `current` est l'état en base : les règles qui
 * lient plusieurs champs (seuil ⇒ délibération) portent sur l'état final.
 */
export function validateParametresPatch(body: Record<string, unknown>, current: CommuneParametres): ValidationResult {
  const updates: ParametresPatch = {};
  const errors: Record<string, string> = {};

  const seuil = toNumber(body.seuil_delegation_maire_ht);
  if (seuil !== undefined) {
    if (seuil !== null && (Number.isNaN(seuil) || seuil < 0)) errors.seuil_delegation_maire_ht = "Indiquez un montant positif, ou laissez vide.";
    else updates.seuil_delegation_maire_ht = seuil;
  }
  const num = toText(body.delegation_deliberation_num);
  if (num !== undefined) updates.delegation_deliberation_num = num;
  const date = toText(body.delegation_deliberation_date);
  if (date !== undefined) {
    if (date !== null && !DATE_RE.test(date)) errors.delegation_deliberation_date = "Date invalide.";
    else updates.delegation_deliberation_date = date;
  }

  if (body.regles_internes_actives !== undefined) updates.regles_internes_actives = body.regles_internes_actives === true;
  const nb = toNumber(body.nb_devis_exige);
  if (nb !== undefined) {
    if (nb === null || Number.isNaN(nb) || !Number.isInteger(nb) || nb < 1 || nb > 10) errors.nb_devis_exige = "Entre 1 et 10 devis.";
    else updates.nb_devis_exige = nb;
  }
  const seuilDevis = toNumber(body.seuil_devis_exige_ht);
  if (seuilDevis !== undefined) {
    if (seuilDevis === null || Number.isNaN(seuilDevis) || seuilDevis < 0) errors.seuil_devis_exige_ht = "Indiquez un montant positif.";
    else updates.seuil_devis_exige_ht = seuilDevis;
  }

  for (const key of ["taux_fctva", "taux_inflation", "taux_actualisation"] as const) {
    const v = toNumber(body[key]);
    if (v === undefined) continue;
    if (v === null || Number.isNaN(v) || v < 0 || v > 100) errors[key] = "Un pourcentage entre 0 et 100.";
    else updates[key] = v;
  }

  const insee = toText(body.code_insee);
  if (insee !== undefined) {
    const up = insee?.toUpperCase() ?? null;
    if (up !== null && !INSEE_RE.test(up)) errors.code_insee = "Le code INSEE compte 5 caractères (ex. 85065, ou 2A004 en Corse).";
    else updates.code_insee = up;
  }

  // Le seuil n'a de valeur que rattaché à sa délibération (état final).
  const finalSeuil = "seuil_delegation_maire_ht" in updates ? updates.seuil_delegation_maire_ht : current.seuil_delegation_maire_ht;
  const finalNum = "delegation_deliberation_num" in updates ? updates.delegation_deliberation_num : current.delegation_deliberation_num;
  const finalDate = "delegation_deliberation_date" in updates ? updates.delegation_deliberation_date : current.delegation_deliberation_date;
  if (finalSeuil !== null && finalSeuil !== undefined && !errors.seuil_delegation_maire_ht) {
    if (!finalNum) errors.delegation_deliberation_num = "Indiquez le numéro de la délibération de délégation.";
    if (!finalDate) errors.delegation_deliberation_date = "Indiquez la date de la délibération de délégation.";
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, updates };
}
