// ═══════════════════════════════════════════════════════════════
// Catégories et urgence des signalements (lot 2) — logique pure.
//
// La taxonomie vit en base (`ticket_categories`, une par commune,
// copiée depuis `ticket_categories_seed()` puis administrée). Ici :
// arbre, chemin lisible, réglages effectifs (sous-catégorie → catégorie),
// urgence, délai cible et suggestion de requalification.
// ═══════════════════════════════════════════════════════════════

export type Urgence = "faible" | "normale" | "urgente" | "danger_immediat";

export const URGENCES: Urgence[] = ["faible", "normale", "urgente", "danger_immediat"];

export const URGENCE_LABELS: Record<Urgence, string> = {
  faible: "Faible",
  normale: "Normale",
  urgente: "Urgente",
  danger_immediat: "Danger immédiat",
};

export const URGENCE_AIDE: Record<Urgence, string> = {
  faible: "À traiter quand possible",
  normale: "Délai normal d'intervention",
  urgente: "À traiter rapidement",
  danger_immediat: "Risque pour les personnes : intervention immédiate",
};

/** Couleurs lisibles (texte ≥ 4,5:1 sur le fond). */
export const URGENCE_COLORS: Record<Urgence, { bg: string; fg: string }> = {
  faible: { bg: "oklch(0.95 0.005 258)", fg: "#4B5563" },
  normale: { bg: "oklch(0.95 0.05 258)", fg: "#1a55b8" },
  urgente: { bg: "#FEF3E2", fg: "#7A4B00" },
  danger_immediat: { bg: "#E00114", fg: "#FFFFFF" },
};

/** Ordre de tri : la plus urgente d'abord. */
export const URGENCE_RANG: Record<Urgence, number> = { danger_immediat: 0, urgente: 1, normale: 2, faible: 3 };

export function estUrgence(v: unknown): v is Urgence {
  return typeof v === "string" && (URGENCES as string[]).includes(v);
}

/** Miroir du déclencheur `tickets_sync_categorie_urgence` (migration 059). */
export function prioriteDepuisUrgence(u: Urgence): "basse" | "normale" | "haute" | "urgente" {
  switch (u) {
    case "faible": return "basse";
    case "normale": return "normale";
    case "urgente": return "haute";
    default: return "urgente";
  }
}

export function urgenceDepuisPriorite(p: string): Urgence {
  if (p === "basse") return "faible";
  if (p === "normale") return "normale";
  return "urgente";
}

export interface CategorieTicket {
  id: string;
  parent_id: string | null;
  code: string;
  libelle: string;
  icone: string | null;
  ordre: number;
  actif: boolean;
  service_defaut_id: string | null;
  urgence_defaut: Urgence | null;
  confidentialite_defaut: "standard" | "restreint" | "confidentiel" | null;
  delai_cible_heures: number | null;
  gestionnaire_externe: string | null;
  consigne_urgence: string | null;
  /** Lot 5 : fonctions prévenues et nommées destinataires à la création. */
  notifier_fonctions?: string[] | null;
}

export interface NoeudCategorie extends CategorieTicket {
  enfants: CategorieTicket[];
}

/** Arbre catégories → sous-catégories, trié par ordre puis libellé. */
export function arborescence(cats: CategorieTicket[], { actifsSeulement = false } = {}): NoeudCategorie[] {
  const tri = (a: CategorieTicket, b: CategorieTicket) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, "fr");
  const garder = (c: CategorieTicket) => !actifsSeulement || c.actif;
  const racines = cats.filter((c) => !c.parent_id && garder(c)).sort(tri);
  return racines.map((r) => ({
    ...r,
    enfants: cats.filter((c) => c.parent_id === r.id && garder(c)).sort(tri),
  }));
}

/** « Voirie & circulation › Nid-de-poule » (ou la catégorie seule). */
export function cheminCategorie(id: string | null | undefined, cats: CategorieTicket[]): {
  racine: CategorieTicket | null; sous: CategorieTicket | null; libelle: string;
} {
  const c = id ? cats.find((x) => x.id === id) ?? null : null;
  if (!c) return { racine: null, sous: null, libelle: "Sans catégorie" };
  if (!c.parent_id) return { racine: c, sous: null, libelle: c.libelle };
  const racine = cats.find((x) => x.id === c.parent_id) ?? null;
  return { racine, sous: c, libelle: racine ? `${racine.libelle} › ${c.libelle}` : c.libelle };
}

export interface ReglagesCategorie {
  urgence: Urgence;
  confidentialite: "standard" | "restreint" | "confidentiel";
  serviceId: string | null;
  delaiHeures: number | null;
  gestionnaire: string | null;
  consigne: string | null;
}

/** Réglages effectifs : la sous-catégorie précise, la catégorie complète. */
export function reglagesEffectifs(id: string | null | undefined, cats: CategorieTicket[]): ReglagesCategorie {
  const { racine, sous } = cheminCategorie(id, cats);
  const pick = <K extends keyof CategorieTicket>(k: K) => (sous?.[k] ?? racine?.[k] ?? null) as CategorieTicket[K] | null;
  return {
    urgence: (pick("urgence_defaut") as Urgence | null) ?? "normale",
    confidentialite: pick("confidentialite_defaut") ?? "standard",
    serviceId: pick("service_defaut_id"),
    delaiHeures: pick("delai_cible_heures"),
    gestionnaire: pick("gestionnaire_externe"),
    consigne: pick("consigne_urgence"),
  };
}

/** « 4 h », « 2 jours », « 1 semaine ». */
export function formatDelai(heures: number | null | undefined): string {
  if (!heures) return "Aucun";
  if (heures < 24) return `${heures} h`;
  if (heures % 168 === 0) {
    const s = heures / 168;
    return `${s} semaine${s > 1 ? "s" : ""}`;
  }
  const j = Math.round(heures / 24);
  return `${j} jour${j > 1 ? "s" : ""}`;
}

export type EtatDelai = "a_temps" | "proche" | "depasse";

/**
 * État du délai cible d'un signalement ouvert : dépassé, proche (moins
 * de 20 % du délai ou de 4 h restant) ou à temps. Null si pas de délai
 * ou signalement clôturé.
 */
export function etatDelai(
  delaiCibleLe: string | null | undefined, creeLe: string, ouvert: boolean, maintenant = new Date(),
): EtatDelai | null {
  if (!delaiCibleLe || !ouvert) return null;
  const fin = new Date(delaiCibleLe).getTime();
  const debut = new Date(creeLe).getTime();
  const now = maintenant.getTime();
  if (now >= fin) return "depasse";
  const reste = fin - now;
  const total = Math.max(fin - debut, 1);
  return reste <= Math.max(total * 0.2, 4 * 3600 * 1000) ? "proche" : "a_temps";
}

// ─── Suggestion de requalification (« Autre » → sous-catégorie) ───

/** Mots-clés complémentaires aux libellés, par code de sous-catégorie. */
const MOTS_CLES: Record<string, string[]> = {
  nid_de_poule: ["trou", "nid de poule", "nid-de-poule"],
  chaussee_degradee: ["chaussee", "route abimee", "goudron", "bitume"],
  signalisation: ["panneau stop", "marquage", "signalisation", "sens interdit"],
  feu_tricolore: ["feu rouge", "feu tricolore"],
  trottoir: ["trottoir"],
  stationnement_genant: ["stationnement", "garee", "gare sur"],
  ralentisseur: ["ralentisseur", "dos d'ane", "coussin berlinois"],
  deneigement: ["neige", "verglas", "salage"],
  lampadaire_panne: ["lampadaire", "candelabre", "eclairage", "lumiere", "ampoule"],
  depot_sauvage: ["depot sauvage", "dechets", "ordures", "sacs poubelle"],
  poubelle: ["poubelle", "corbeille", "bac"],
  encombrants: ["encombrant", "matelas", "frigo"],
  tags: ["tag", "graffiti"],
  dejections: ["dejection", "crotte"],
  elagage: ["elagage", "elaguer", "branches"],
  arbre_dangereux: ["arbre", "branche cassee", "arbres tombes", "tempete"],
  tonte_desherbage: ["tonte", "tondre", "herbe", "desherbage"],
  frelons: ["frelon", "guepe", "essaim", "nid d'insecte"],
  haie: ["haie"],
  chien_errant: ["chien", "divagant"],
  chat_errant: ["chat"],
  animal_blesse: ["animal mort", "animal blesse", "cadavre"],
  nuisibles: ["rat", "pigeon", "souris", "nuisible"],
  fuite: ["fuite d'eau", "fuite"],
  egout_bouche: ["egout", "avaloir", "grille bouchee"],
  inondation: ["inondation", "inonde"],
  fosse_busage: ["fosse", "busage", "buse"],
  chauffage: ["chauffage", "radiateur", "chaudiere"],
  electricite: ["electricite", "electrique", "disjoncteur", "prise", "brule", "bruler", "court-circuit"],
  plomberie: ["plomberie", "robinet", "toilettes", "wc", "evier"],
  serrurerie: ["serrure", "cle", "verrou"],
  toiture: ["toiture", "toit", "infiltration", "gouttiere"],
  vitrage: ["vitre", "carreau"],
  menage: ["menage", "nettoyage", "nettoyer"],
  fibre_internet: ["fibre", "internet", "box"],
  telephonie: ["telephonique", "telephone"],
  cable_tombe: ["cable", "fil au sol", "cable au sol"],
  poteau_incline: ["poteau"],
  odeur_gaz: ["gaz"],
  banc: ["banc"],
  abribus: ["abribus", "arret de bus"],
  panneau_affichage: ["affichage", "panneau electoral", "affiche"],
  jeux_enfants: ["jeux", "toboggan", "balancoire", "cityparc", "city stade", "but de foot", "buts de foot"],
  barriere: ["barriere"],
  concession: ["concession"],
  entretien: ["cimetiere", "tombe"],
  nuisances_sonores: ["nuisance sonore", "nuisances sonores", "bruit", "tapage"],
  vehicule_epave: ["epave", "caravane", "vehicule abandonne"],
  incivilite: ["incivilite", "conflit", "voisin", "voisins"],
  materiel_cantine: ["cantine", "garderie", "seche-linge"],
  batiment_ecole: ["ecole", "perisco", "periscolaire"],
  pret_materiel: ["pret de materiel", "tables", "chaises", "barnum"],
  montage: ["montage", "demontage", "installation"],
  salle: ["salle", "location salle", "salles communales"],
  poste: ["ordinateur", "pc"],
  imprimante: ["imprimante"],
  logiciel: ["logiciel"],
  acces: ["mot de passe", "acces"],
  site_web: ["site web", "site internet"],
  courrier: ["courrier", "lettre"],
  rendez_vous: ["rendez-vous", "rendez vous", "rdv", "rencontrer"],
  signature: ["signer", "signature", "parapheur", "mandats", "arrete", "comptabilite"],
  achats: ["achat", "commande", "devis"],
};

/** Minuscules, sans accents ni ponctuation superflue. */
export function normaliser(texte: string): string {
  return texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9' -]/g, " ").replace(/\s+/g, " ").trim();
}

const VIDES = new Set(["de", "du", "des", "la", "le", "les", "et", "ou", "en", "au", "aux", "un", "une", "sur", "pour", "avec", "par", "d'un", "d'une"]);

/**
 * Suggère la sous-catégorie la plus probable pour un texte (titre +
 * description). Score : mots-clés (2 points, 3 s'ils sont dans le titre)
 * et mots du libellé (1 point). Null si rien ne ressort.
 */
export function suggererCategorie(
  titre: string, description: string | null, cats: CategorieTicket[],
): { id: string; score: number } | null {
  const t = ` ${normaliser(titre)} `;
  const d = ` ${normaliser(description ?? "")} `;
  let meilleur: { id: string; score: number } | null = null;
  for (const c of cats) {
    if (!c.parent_id || !c.actif || c.code === "autre") continue;
    let score = 0;
    for (const mot of MOTS_CLES[c.code] ?? []) {
      const m = ` ${normaliser(mot)}`;
      if (t.includes(m)) score += 3;
      else if (d.includes(m)) score += 2;
    }
    for (const mot of normaliser(c.libelle).split(" ")) {
      if (mot.length < 4 || VIDES.has(mot)) continue;
      if (t.includes(` ${mot}`) || d.includes(` ${mot}`)) score += 1;
    }
    if (score > 0 && (!meilleur || score > meilleur.score)) meilleur = { id: c.id, score };
  }
  return meilleur && meilleur.score >= 2 ? meilleur : null;
}
