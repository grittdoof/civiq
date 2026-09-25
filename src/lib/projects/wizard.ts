// ═══════════════════════════════════════════════════════════════
// Parcours de création d'un projet (brief §2.2 – 2.3) — logique pure,
// partagée entre l'assistant (client), l'API et les tests.
//
//   investissement : Quoi ? → Qui ? → Combien, à peu près ? → Pour quand ? → Récapitulatif
//   evenementiel   : Quel événement ? → Quand et où ? → Qui organise ? → Récapitulatif
//   suivi_simple   : un seul écran (titre, commission, élu référent)
// ═══════════════════════════════════════════════════════════════

import type { TypeProjetCode } from "./types";

// ─── Fourchettes d'estimation (écran « Combien, à peu près ? ») ───
export type Fourchette = "moins_20k" | "20k_100k" | "100k_500k" | "plus_500k" | "inconnu";

export const FOURCHETTES: Array<{ code: Fourchette; label: string }> = [
  { code: "moins_20k", label: "Moins de 20 000 €" },
  { code: "20k_100k", label: "20 000 à 100 000 €" },
  { code: "100k_500k", label: "100 000 à 500 000 €" },
  { code: "plus_500k", label: "Plus de 500 000 €" },
  { code: "inconnu", label: "Je ne sais pas encore" },
];

// ─── Jalons modèles (types_projet.jalons_modele) ───
export interface JalonModele {
  libelle: string;
  /** Position relative à la date de l'événement, en jours (J-30 → -30). */
  offset_jours?: number;
  /** Proposé décoché (ex. buvette, SACEM). */
  conditionnel?: boolean;
  aide?: string;
  verrou?: string;
}

export interface JalonPropose {
  libelle: string;
  /** ISO, heure murale en composantes UTC (convention Session 16). */
  date_previsionnelle: string | null;
  coche: boolean;
  conditionnel: boolean;
  aide: string | null;
  offset_jours: number | null;
}

const DAY = 24 * 60 * 60 * 1000;

/** « 2026-11-11 » (+ heure « 10:30 ») → ISO en composantes UTC. */
export function wallClockIso(date: string, time?: string | null): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return `${date}T${t}:00.000Z`;
}

/**
 * Jalons proposés à la création. Pour un événement, ils sont positionnés
 * à rebours de la date (rétroplanning) ; sinon, sans date.
 */
export function proposerJalons(modeles: JalonModele[], dateEvenement?: string | null): JalonPropose[] {
  const base = dateEvenement ? Date.parse(wallClockIso(dateEvenement) ?? "") : NaN;
  return modeles.map((m) => {
    const offset = typeof m.offset_jours === "number" ? m.offset_jours : null;
    const date =
      offset !== null && !Number.isNaN(base) ? new Date(base + offset * DAY).toISOString() : null;
    return {
      libelle: m.libelle,
      date_previsionnelle: date,
      coche: !m.conditionnel,
      conditionnel: !!m.conditionnel,
      aide: m.aide ?? null,
      offset_jours: offset,
    };
  });
}

/** Libellé court d'une position à rebours : J-90, J-3, Jour J, J+7. */
export function formatOffset(offset: number): string {
  if (offset === 0) return "Jour J";
  return offset < 0 ? `J${offset}` : `J+${offset}`;
}

// ─── Encart « Ce que la loi impose ici » (récapitulatif investissement) ───
// Seuils de dispense de publicité en vigueur au 25/09/2026 (brief §2.7,
// à revérifier) ; le lot C les lira dans la table versionnée
// seuils_commande_publique au lieu de ces constantes.
export const SEUILS_REFERENCE = {
  travaux_dispense_ht: 100_000,
  fournitures_services_dispense_ht: 60_000,
  travaux_europeen_ht: 5_404_000,
  reference: "Décret n° 2025-1386 du 29 décembre 2025",
};

export type Registre = "obligatoire" | "recommande" | "information";

export interface EncartMarches {
  registre: Registre;
  titre: string;
  paragraphes: string[];
  enSavoirPlus: string[];
}

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} €`;

export function encartMarchesPublics(f: Fourchette | null | undefined): EncartMarches | null {
  if (!f) return null;
  const s = SEUILS_REFERENCE;
  const recommande =
    "Recommandé : demandez tout de même plusieurs devis. La commune ne doit pas confier systématiquement ses achats à la même entreprise lorsque plusieurs peuvent répondre au besoin.";
  const savoir = [
    `Seuils de dispense de publicité : ${fmt(s.travaux_dispense_ht)} hors taxes (HT) pour des travaux, ${fmt(
      s.fournitures_services_dispense_ht,
    )} HT pour des fournitures ou des services (${s.reference}).`,
    "Ces seuils sont fixés par décret pour toutes les communes. Le montant que le conseil délègue au maire est une autre règle, que vous pouvez renseigner dans les paramètres de la commune.",
  ];
  switch (f) {
    case "moins_20k":
      return {
        registre: "recommande",
        titre: "Ce que la loi prévoit ici",
        paragraphes: [
          "Votre projet est estimé à moins de 20 000 €. Vous n'êtes pas obligé de publier un avis de marché.",
          recommande,
        ],
        enSavoirPlus: savoir,
      };
    case "20k_100k":
      return {
        registre: "recommande",
        titre: "Ce que la loi prévoit ici",
        paragraphes: [
          `Votre projet est estimé entre 20 000 et 100 000 €. En dessous de ${fmt(
            s.travaux_dispense_ht,
          )} hors taxes (HT) pour des travaux, vous n'êtes pas obligé de publier un avis de marché. Pour des fournitures ou des services, cette dispense s'arrête à ${fmt(
            s.fournitures_services_dispense_ht,
          )} HT.`,
          recommande,
        ],
        enSavoirPlus: savoir,
      };
    case "100k_500k":
    case "plus_500k":
      return {
        registre: "obligatoire",
        titre: "Ce que la loi impose ici",
        paragraphes: [
          `Obligatoire : au-delà de ${fmt(s.travaux_dispense_ht)} hors taxes (HT) pour des travaux (${fmt(
            s.fournitures_services_dispense_ht,
          )} HT pour des fournitures ou des services), le marché doit faire l'objet d'une publicité et d'une mise en concurrence.`,
          "GoCiviq vous le rappellera à l'étape « Consultation des entreprises ».",
        ],
        enSavoirPlus:
          f === "plus_500k"
            ? [
                ...savoir,
                `Au-delà de ${fmt(s.travaux_europeen_ht)} HT pour des travaux, une procédure européenne formalisée s'applique.`,
              ]
            : savoir,
      };
    case "inconnu":
      return {
        registre: "information",
        titre: "Pour information",
        paragraphes: [
          "Dès que vous aurez un ordre de grandeur, indiquez-le : GoCiviq vous dira alors quelles règles de marchés publics s'appliquent.",
        ],
        enSavoirPlus: [],
      };
  }
}

// ─── Données saisies & validation ───
export interface WizardInput {
  type_code: TypeProjetCode;
  titre: string;
  description?: string;
  commission_pilote_id?: string | null;
  commissions_associees?: string[];
  elu_referent_id?: string | null;
  agent_pilote_id?: string | null;
  contributeurs?: string[];
  fourchette_estimation?: Fourchette | null;
  echeance_souhaitee?: string | null;
  sans_echeance?: boolean;
  evenement_date?: string | null;
  evenement_heure_debut?: string | null;
  evenement_heure_fin?: string | null;
  lieu?: string | null;
  jauge?: number | string | null;
  partenaires?: string[];
  jalons?: Array<{ libelle: string; date_previsionnelle: string | null }>;
  source_ticket_id?: string | null;
}

/** Payload attendu par create_project_from_wizard (hors commune/auteur). */
export interface WizardPayload {
  type_code: TypeProjetCode;
  titre: string;
  description: string | null;
  commission_pilote_id: string | null;
  commissions_associees: string[];
  elu_referent_id: string | null;
  agent_pilote_id: string | null;
  contributeurs: string[];
  fourchette_estimation: Fourchette | null;
  echeance_souhaitee: string | null;
  evenement_debut: string | null;
  evenement_fin: string | null;
  lieu: string | null;
  jauge: number | null;
  partenaires: string[];
  jalons: Array<{ libelle: string; date_previsionnelle: string | null }>;
  source_ticket_id: string | null;
}

const TYPES: TypeProjetCode[] = ["investissement", "evenementiel", "suivi_simple"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v: unknown) => (typeof v === "string" && UUID_RE.test(v) ? v : null);
const uuids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && UUID_RE.test(x)))] : []);

export type WizardValidation =
  | { ok: true; payload: WizardPayload }
  | { ok: false; errors: Record<string, string> };

export function validateWizard(input: WizardInput): WizardValidation {
  const errors: Record<string, string> = {};
  const type = input.type_code;
  if (!TYPES.includes(type)) return { ok: false, errors: { type_code: "Choisissez un type de projet." } };

  const titre = (input.titre ?? "").trim();
  if (!titre) errors.titre = "Donnez un titre au projet.";
  else if (titre.length > 200) errors.titre = "200 caractères au maximum.";

  const elu = uuidOrNull(input.elu_referent_id);
  if (!elu) errors.elu_referent_id = "Choisissez l'élu référent : une seule personne responsable du suivi.";

  let fourchette: Fourchette | null = null;
  let echeance: string | null = null;
  let debut: string | null = null;
  let fin: string | null = null;
  let jauge: number | null = null;

  if (type === "investissement") {
    const f = input.fourchette_estimation ?? null;
    fourchette = f && FOURCHETTES.some((x) => x.code === f) ? f : null;
    if (!input.sans_echeance && input.echeance_souhaitee) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.echeance_souhaitee)) errors.echeance_souhaitee = "Date invalide.";
      else echeance = input.echeance_souhaitee;
    }
  }

  if (type === "evenementiel") {
    const d = input.evenement_date ?? "";
    debut = wallClockIso(d, input.evenement_heure_debut);
    if (!debut) errors.evenement_date = "Indiquez la date de l'événement.";
    if (debut && input.evenement_heure_fin) {
      fin = wallClockIso(d, input.evenement_heure_fin);
      if (fin && fin < debut) errors.evenement_heure_fin = "L'heure de fin doit suivre l'heure de début.";
    }
    if (input.jauge !== undefined && input.jauge !== null && input.jauge !== "") {
      const n = Number(input.jauge);
      if (!Number.isInteger(n) || n < 0) errors.jauge = "Indiquez un nombre de personnes.";
      else jauge = n;
    }
  }

  const jalons = (input.jalons ?? [])
    .map((j) => ({ libelle: (j.libelle ?? "").trim(), date_previsionnelle: j.date_previsionnelle ?? null }))
    .filter((j) => j.libelle)
    .slice(0, 50);

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      type_code: type,
      titre,
      description: input.description?.trim() || null,
      commission_pilote_id: uuidOrNull(input.commission_pilote_id),
      commissions_associees: uuids(input.commissions_associees).filter((c) => c !== input.commission_pilote_id),
      elu_referent_id: elu,
      agent_pilote_id: uuidOrNull(input.agent_pilote_id),
      contributeurs: uuids(input.contributeurs),
      fourchette_estimation: fourchette,
      echeance_souhaitee: echeance,
      evenement_debut: debut,
      evenement_fin: fin,
      lieu: type === "evenementiel" ? input.lieu?.trim() || null : null,
      jauge,
      partenaires: type === "evenementiel" ? uuids(input.partenaires) : [],
      jalons,
      source_ticket_id: uuidOrNull(input.source_ticket_id),
    },
  };
}
