// ═══════════════════════════════════════════════════════════════
// Validation des saisies financières (budget, devis, subventions) —
// pure, partagée API ↔ tests. Le HT est obligatoire là où un seuil ou
// une subvention est en jeu ; le TTC est toujours dérivé côté serveur.
// ═══════════════════════════════════════════════════════════════

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Montant saisi (nombre ou texte « 12 500,50 »). undefined = absent, NaN = invalide. */
export function parseMontant(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[\s  €]/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}
function parseDate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return typeof v === "string" && DATE_RE.test(v) ? v : "invalid";
}
function text(v: unknown, max = 500): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = String(v).trim();
  return t ? t.slice(0, max) : null;
}
function tva(v: unknown): number | undefined | typeof NaN {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : NaN;
}

// ─── Lignes de budget ───
export const CATEGORIES_DEPENSE = ["travaux", "etudes", "acquisition", "prestataire", "materiel", "location", "personnel", "communication", "autre"] as const;
export const CATEGORIES_RECETTE = ["buvette", "billetterie", "participation", "subvention", "mecenat", "autre"] as const;
export const CATEGORIE_LABELS: Record<string, string> = {
  travaux: "Travaux", etudes: "Études", acquisition: "Acquisition", prestataire: "Prestataire",
  materiel: "Matériel", location: "Location", personnel: "Personnel", communication: "Communication",
  buvette: "Buvette", billetterie: "Billetterie", participation: "Participation des associations",
  subvention: "Subvention de fonctionnement", mecenat: "Mécénat local", autre: "Autre",
};

export interface BudgetLineFields {
  sens?: "depense" | "recette";
  categorie?: string | null;
  libelle?: string;
  montant_prevu?: number | null;
  montant_reel?: number | null;
  taux_tva?: number;
  etat?: "previsionnel" | "engage" | "mandate";
  chapitre_m57?: string | null;
  operation?: string | null;
  notes?: string | null;
}

export function parseBudgetLine(body: Record<string, unknown>, creation: boolean): Parsed<BudgetLineFields> {
  const f: BudgetLineFields = {};
  if (creation || "sens" in body) {
    if (body.sens !== "depense" && body.sens !== "recette") return { ok: false, error: "Indiquez s'il s'agit d'une dépense ou d'une recette." };
    f.sens = body.sens;
  }
  if (creation || "libelle" in body) {
    const l = text(body.libelle, 300);
    if (!l) return { ok: false, error: "Le libellé est obligatoire." };
    f.libelle = l;
  }
  if ("categorie" in body) {
    const c = text(body.categorie, 40);
    if (c && !(c in CATEGORIE_LABELS)) return { ok: false, error: "Catégorie inconnue." };
    f.categorie = c ?? null;
  }
  for (const k of ["montant_prevu", "montant_reel"] as const) {
    const m = parseMontant(body[k]);
    if (Number.isNaN(m)) return { ok: false, error: "Montant invalide." };
    if (m !== undefined) f[k] = m;
  }
  const t = tva(body.taux_tva);
  if (Number.isNaN(t)) return { ok: false, error: "Taux de TVA invalide (entre 0 et 100 %)." };
  if (t !== undefined) f.taux_tva = t as number;
  if ("etat" in body) {
    if (!["previsionnel", "engage", "mandate"].includes(String(body.etat))) return { ok: false, error: "État inconnu." };
    f.etat = body.etat as BudgetLineFields["etat"];
  }
  for (const k of ["chapitre_m57", "operation", "notes"] as const) {
    const v = text(body[k], k === "notes" ? 2000 : 60);
    if (v !== undefined) f[k] = v;
  }
  if (creation && f.montant_prevu === undefined && f.montant_reel === undefined) {
    return { ok: false, error: "Indiquez un montant." };
  }
  return { ok: true, value: f };
}

// ─── Devis ───
export interface QuoteFields {
  prestataire?: string;
  contact_id?: string | null;
  objet?: string | null;
  lot?: string | null;
  montant_ht?: number;
  taux_tva?: number;
  date_reception?: string | null;
  validite?: string | null;
  statut?: "recu" | "en_attente" | "retenu" | "non_retenu";
  document_id?: string | null;
  notes?: string | null;
}

export function parseQuote(body: Record<string, unknown>, creation: boolean): Parsed<QuoteFields> {
  const f: QuoteFields = {};
  if (creation || "prestataire" in body) {
    const p = text(body.prestataire, 200);
    if (!p) return { ok: false, error: "Indiquez l'entreprise." };
    f.prestataire = p;
  }
  if (creation || "montant_ht" in body) {
    const m = parseMontant(body.montant_ht);
    if (m === null || m === undefined || Number.isNaN(m)) {
      return { ok: false, error: "Le montant hors taxes (HT) est obligatoire : c'est lui qui sert aux règles des marchés publics." };
    }
    f.montant_ht = m;
  }
  const t = tva(body.taux_tva);
  if (Number.isNaN(t)) return { ok: false, error: "Taux de TVA invalide (entre 0 et 100 %)." };
  if (t !== undefined) f.taux_tva = t as number;
  for (const k of ["date_reception", "validite"] as const) {
    const d = parseDate(body[k]);
    if (d === "invalid") return { ok: false, error: "Date invalide." };
    if (d !== undefined) f[k] = d;
  }
  if ("statut" in body) {
    if (!["recu", "en_attente", "retenu", "non_retenu"].includes(String(body.statut))) return { ok: false, error: "Statut inconnu." };
    f.statut = body.statut as QuoteFields["statut"];
  }
  for (const k of ["contact_id", "document_id"] as const) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === null || v === "") f[k] = null;
    else if (typeof v === "string" && UUID_RE.test(v)) f[k] = v;
    else return { ok: false, error: "Référence invalide." };
  }
  for (const k of ["objet", "lot", "notes"] as const) {
    const v = text(body[k], k === "notes" ? 2000 : 200);
    if (v !== undefined) f[k] = v;
  }
  return { ok: true, value: f };
}

// ─── Subventions (table financings) ───
export const SUBVENTION_STATUTS = ["a_demander", "demandee", "ar_recu", "accordee", "refusee", "soldee"] as const;
export const SUBVENTION_STATUT_META: Record<(typeof SUBVENTION_STATUTS)[number], { label: string; aide: string }> = {
  a_demander: { label: "À contacter", aide: "La demande n'est pas encore déposée." },
  demandee: { label: "Dossier déposé", aide: "En attente de l'accusé de réception du financeur." },
  ar_recu: { label: "En cours d'étude", aide: "Le financeur a accusé réception : il étudie le dossier." },
  accordee: { label: "Accordé", aide: "Le financeur a notifié son accord." },
  refusee: { label: "Refusé", aide: "Le financeur a refusé la demande." },
  soldee: { label: "Soldé", aide: "La subvention a été entièrement versée." },
};

export interface FinancingFields {
  financeur?: string;
  contact_id?: string | null;
  dispositif?: string | null;
  assiette_ht?: number | null;
  taux?: number | null;
  montant_demande?: number | null;
  montant_obtenu?: number | null;
  statut?: (typeof SUBVENTION_STATUTS)[number];
  date_demande?: string | null;
  date_ar?: string | null;
  date_decision?: string | null;
  notes?: string | null;
  source?: "api" | "local" | "saisie_libre";
  aide_ref?: string | null;
  financeur_local_id?: string | null;
}

export function parseFinancing(body: Record<string, unknown>, creation: boolean): Parsed<FinancingFields> {
  const f: FinancingFields = {};
  if (creation || "financeur" in body) {
    const n = text(body.financeur, 200);
    if (!n) return { ok: false, error: "Indiquez le financeur." };
    f.financeur = n;
  }
  for (const k of ["assiette_ht", "montant_demande", "montant_obtenu"] as const) {
    const m = parseMontant(body[k]);
    if (Number.isNaN(m)) return { ok: false, error: "Montant invalide." };
    if (m !== undefined) f[k] = m;
  }
  if ("taux" in body) {
    const n = body.taux === null || body.taux === "" ? null : Number(body.taux);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) return { ok: false, error: "Taux invalide (entre 0 et 100 %)." };
    f.taux = n;
  }
  if ("statut" in body) {
    if (!SUBVENTION_STATUTS.includes(body.statut as never)) return { ok: false, error: "Statut inconnu." };
    f.statut = body.statut as FinancingFields["statut"];
  }
  for (const k of ["date_demande", "date_ar", "date_decision"] as const) {
    const d = parseDate(body[k]);
    if (d === "invalid") return { ok: false, error: "Date invalide." };
    if (d !== undefined) f[k] = d;
  }
  if (f.date_ar && f.date_demande && f.date_ar < f.date_demande) {
    return { ok: false, error: "L'accusé de réception ne peut pas précéder le dépôt de la demande." };
  }
  if ("contact_id" in body) {
    const v = body.contact_id;
    if (v === null || v === "") f.contact_id = null;
    else if (typeof v === "string" && UUID_RE.test(v)) f.contact_id = v;
    else return { ok: false, error: "Référence invalide." };
  }
  for (const k of ["dispositif", "notes"] as const) {
    const v = text(body[k], k === "notes" ? 2000 : 200);
    if (v !== undefined) f[k] = v;
  }
  if ("source" in body) {
    if (!["api", "local", "saisie_libre"].includes(String(body.source))) return { ok: false, error: "Origine inconnue." };
    f.source = body.source as FinancingFields["source"];
  }
  const ref = text(body.aide_ref, 80);
  if (ref !== undefined) f.aide_ref = ref;
  if ("financeur_local_id" in body) {
    const v = body.financeur_local_id;
    if (v === null || v === "") f.financeur_local_id = null;
    else if (typeof v === "string" && UUID_RE.test(v)) f.financeur_local_id = v;
    else return { ok: false, error: "Référence invalide." };
  }
  return { ok: true, value: f };
}
