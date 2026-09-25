// Fiches de financeurs locaux (brief §2.9, source secondaire) — validation pure.

export const TYPES_PROJET = ["investissement", "evenementiel", "suivi_simple"] as const;

export interface FinanceurLocal {
  id: string;
  nom: string;
  contact_id: string | null;
  types_projet: string[];
  periode_depot: string | null;
  lien: string | null;
  notes: string | null;
}

/** Suggestions de départ, pour ce que l'API couvre mal. */
export const EXEMPLES_FINANCEURS_LOCAUX = [
  "Fonds de concours de l'intercommunalité",
  "Produit des amendes de police (répartition départementale)",
  "Fondation du patrimoine et souscription publique",
  "Mécénat d'entreprise local",
  "Fondations privées",
];

export function parseFinanceurLocal(
  body: Record<string, unknown>,
  creation: boolean,
): { ok: true; value: Partial<Omit<FinanceurLocal, "id" | "contact_id">> } | { ok: false; error: string } {
  const v: Partial<Omit<FinanceurLocal, "id" | "contact_id">> = {};
  if (creation || "nom" in body) {
    const n = typeof body.nom === "string" ? body.nom.trim() : "";
    if (!n) return { ok: false, error: "Indiquez le nom du financeur." };
    v.nom = n.slice(0, 200);
  }
  if ("types_projet" in body) {
    const t = Array.isArray(body.types_projet) ? body.types_projet.filter((x): x is string => TYPES_PROJET.includes(x as never)) : [];
    if (t.length === 0) return { ok: false, error: "Choisissez au moins un type de projet." };
    v.types_projet = [...new Set(t)];
  }
  for (const k of ["periode_depot", "notes"] as const) {
    if (k in body) v[k] = typeof body[k] === "string" && (body[k] as string).trim() ? (body[k] as string).trim().slice(0, k === "notes" ? 2000 : 200) : null;
  }
  if ("lien" in body) {
    const l = typeof body.lien === "string" ? body.lien.trim() : "";
    if (l && !/^https?:\/\//i.test(l)) return { ok: false, error: "Le lien doit commencer par http:// ou https://." };
    v.lien = l || null;
  }
  return { ok: true, value: v };
}
