// ═══════════════════════════════════════════════════════════════
// Validation des réglages d'une catégorie (lot 2) — pure, testée.
// ═══════════════════════════════════════════════════════════════

import { estUrgence } from "./categories";

export interface ReglagesSaisis {
  libelle?: unknown;
  icone?: unknown;
  actif?: unknown;
  ordre?: unknown;
  service_defaut_id?: unknown;
  urgence_defaut?: unknown;
  confidentialite_defaut?: unknown;
  delai_cible_heures?: unknown;
  gestionnaire_externe?: unknown;
  consigne_urgence?: unknown;
}

export type ReglagesValides = Partial<{
  libelle: string;
  icone: string | null;
  actif: boolean;
  ordre: number;
  service_defaut_id: string | null;
  urgence_defaut: string | null;
  confidentialite_defaut: string | null;
  delai_cible_heures: number | null;
  gestionnaire_externe: string | null;
  consigne_urgence: string | null;
}>;

const texte = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new Error("Valeur texte attendue");
  const t = v.trim().replace(/\s+\n/g, "\n");
  if (t.length > max) throw new Error(`Texte trop long (${max} caractères au maximum)`);
  return t || null;
};

/** Contrôle et normalise les champs fournis ; lève une erreur lisible sinon. */
export function validerReglages(b: ReglagesSaisis, iconesConnues: readonly string[]): ReglagesValides {
  const out: ReglagesValides = {};
  if (b.libelle !== undefined) {
    const l = texte(b.libelle, 80);
    if (!l || l.length < 2) throw new Error("Libellé : 2 à 80 caractères");
    out.libelle = l;
  }
  if (b.icone !== undefined) {
    const i = texte(b.icone, 40);
    if (i && !iconesConnues.includes(i)) throw new Error("Icône inconnue");
    out.icone = i;
  }
  if (b.actif !== undefined) {
    if (typeof b.actif !== "boolean") throw new Error("Valeur oui / non attendue");
    out.actif = b.actif;
  }
  if (b.ordre !== undefined) {
    if (!Number.isInteger(b.ordre)) throw new Error("Ordre invalide");
    out.ordre = b.ordre as number;
  }
  if (b.service_defaut_id !== undefined) out.service_defaut_id = texte(b.service_defaut_id, 64);
  if (b.urgence_defaut !== undefined) {
    if (b.urgence_defaut !== null && !estUrgence(b.urgence_defaut)) throw new Error("Urgence inconnue");
    out.urgence_defaut = (b.urgence_defaut as string | null) ?? null;
  }
  if (b.confidentialite_defaut !== undefined) {
    const c = b.confidentialite_defaut;
    if (c !== null && c !== "standard" && c !== "restreint" && c !== "confidentiel") throw new Error("Visibilité inconnue");
    out.confidentialite_defaut = (c as string | null) ?? null;
  }
  if (b.delai_cible_heures !== undefined) {
    const d = b.delai_cible_heures;
    if (d !== null && (!Number.isInteger(d) || (d as number) <= 0 || (d as number) > 8760)) {
      throw new Error("Délai cible : de 1 h à 1 an");
    }
    out.delai_cible_heures = (d as number | null) ?? null;
  }
  if (b.gestionnaire_externe !== undefined) out.gestionnaire_externe = texte(b.gestionnaire_externe, 120);
  if (b.consigne_urgence !== undefined) out.consigne_urgence = texte(b.consigne_urgence, 1000);
  return out;
}

/** Code stable à partir du libellé : « Fuite d'eau » → « fuite_d_eau ». */
export function codeDepuisLibelle(libelle: string): string {
  return libelle.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "categorie";
}
