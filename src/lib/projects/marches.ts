// ═══════════════════════════════════════════════════════════════
// Commande publique (brief §2.7) — logique pure.
//
// Trois sources, trois alertes distinctes, jamais confondues :
//   1. Délégation du conseil au maire (paramètre communal)  → Obligatoire
//   2. Seuils nationaux de publicité (table versionnée)      → Obligatoire
//   3. Guide interne des achats (paramètre facultatif)       → Recommandé
// Un paramètre vide ou désactivé ⇒ aucune alerte, aucun message
// « non configuré » : le silence est la bonne réponse.
// Le seuil appliqué est celui en vigueur à la date d'engagement de la
// consultation, pas à la date du jour.
// ═══════════════════════════════════════════════════════════════

import type { Alerte } from "./type-change";
import type { Fourchette, Registre } from "./wizard";

export type CategorieAchat = "travaux" | "fournitures_services";

export interface Seuil {
  categorie: CategorieAchat;
  type: "dispense" | "seuil_europeen";
  montant_ht: number;
  date_effet: string;
  date_fin: string | null;
  reference: string | null;
}

/** Seuil en vigueur à une date donnée (YYYY-MM-DD), ou null. */
export function seuilApplicable(
  seuils: Seuil[],
  categorie: CategorieAchat,
  type: Seuil["type"],
  date: string,
): Seuil | null {
  const d = date.slice(0, 10);
  return (
    seuils
      .filter((s) => s.categorie === categorie && s.type === type && s.date_effet <= d && (!s.date_fin || s.date_fin >= d))
      .sort((a, b) => (a.date_effet < b.date_effet ? 1 : -1))[0] ?? null
  );
}

export interface ParametresMarches {
  seuil_delegation_maire_ht: number | null;
  delegation_deliberation_num: string | null;
  delegation_deliberation_date: string | null;
  regles_internes_actives: boolean;
  nb_devis_exige: number;
  seuil_devis_exige_ht: number;
}

export interface AlerteMarche {
  code: "delegation" | "publicite" | "europeen" | "guide_interne";
  registre: Registre;
  alerte: Alerte;
  enSavoirPlus: string[];
}

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const dateFr = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

/**
 * Alertes applicables à un marché.
 * @param montantHt  montant du marché (devis retenu, sinon estimation HT)
 * @param dateConsultation date d'engagement de la consultation (YYYY-MM-DD)
 * @param nbDevis nombre de devis enregistrés
 */
export function evaluerAlertesMarches(input: {
  montantHt: number | null;
  categorie: CategorieAchat;
  dateConsultation: string;
  nbDevis: number;
  seuils: Seuil[];
  parametres: ParametresMarches;
}): AlerteMarche[] {
  const { montantHt, categorie, dateConsultation, nbDevis, seuils, parametres: p } = input;
  if (montantHt === null || !(montantHt > 0)) return [];
  const out: AlerteMarche[] = [];
  const libCat = categorie === "travaux" ? "des travaux" : "des fournitures ou des services";

  // 1. Délégation au maire (silence si non renseignée).
  if (p.seuil_delegation_maire_ht !== null && montantHt > p.seuil_delegation_maire_ht) {
    const delib =
      p.delegation_deliberation_num && p.delegation_deliberation_date
        ? `délibération n° ${p.delegation_deliberation_num} du ${dateFr(p.delegation_deliberation_date)}`
        : "délibération de délégation";
    out.push({
      code: "delegation",
      registre: "obligatoire",
      alerte: {
        constat: `Ce marché (${eur(montantHt)} hors taxes) dépasse la délégation accordée au maire (${eur(p.seuil_delegation_maire_ht)} HT, ${delib}).`,
        consequence: "Signé sans délibération du conseil municipal, le marché serait irrégulier et pourrait être annulé.",
        actions: ["Inscrivez ce marché à l'ordre du jour du prochain conseil municipal, avant toute signature."],
      },
      enSavoirPlus: [
        "La délégation au maire est prévue par l'article L.2122-22 4° du code général des collectivités territoriales. Son montant est fixé par la délibération de délégation, renseignée dans les paramètres de la commune.",
      ],
    });
  }

  // 2. Seuils nationaux, à la date de la consultation.
  const europeen = seuilApplicable(seuils, categorie, "seuil_europeen", dateConsultation);
  const dispense = seuilApplicable(seuils, categorie, "dispense", dateConsultation);
  if (europeen && montantHt >= europeen.montant_ht) {
    out.push({
      code: "europeen",
      registre: "obligatoire",
      alerte: {
        constat: `Ce marché dépasse le seuil européen (${eur(europeen.montant_ht)} HT pour ${libCat}).`,
        consequence: "Une procédure formalisée, avec publicité européenne, est obligatoire. Sans elle, le marché peut être annulé.",
        actions: ["Faites-vous accompagner (assistance à maîtrise d'ouvrage, centre de gestion, Département) pour lancer la procédure."],
      },
      enSavoirPlus: [`Seuil en vigueur au ${dateFr(dateConsultation)}${europeen.reference ? ` — ${europeen.reference}` : ""}.`],
    });
  } else if (dispense && montantHt >= dispense.montant_ht) {
    out.push({
      code: "publicite",
      registre: "obligatoire",
      alerte: {
        constat: `Ce marché dépasse ${eur(dispense.montant_ht)} hors taxes pour ${libCat}.`,
        consequence: "Il doit faire l'objet d'une publicité et d'une mise en concurrence ; à défaut, il peut être annulé et engager la responsabilité de la commune.",
        actions: ["Publiez un avis d'appel public à la concurrence avant de choisir l'entreprise."],
      },
      enSavoirPlus: [
        `Seuil de dispense en vigueur au ${dateFr(dateConsultation)}, date d'engagement de la consultation${dispense.reference ? ` — ${dispense.reference}` : ""}.`,
        "Ces seuils sont fixés par décret pour toutes les communes, indépendamment de la délégation du conseil au maire.",
      ],
    });
  }

  // 3. Guide interne (recommandation, jamais bloquante ; silence si désactivé).
  if (p.regles_internes_actives && montantHt > p.seuil_devis_exige_ht && nbDevis < p.nb_devis_exige) {
    out.push({
      code: "guide_interne",
      registre: "recommande",
      alerte: {
        constat: `Votre guide interne prévoit ${p.nb_devis_exige} devis au-delà de ${eur(p.seuil_devis_exige_ht)} HT. Vous n'en avez enregistré que ${nbDevis}.`,
        consequence: "La règle que la commune s'est fixée ne serait pas respectée.",
        actions: ["Demandez des devis supplémentaires avant de choisir l'entreprise."],
      },
      enSavoirPlus: [],
    });
  }

  return out;
}

/** Montant de référence d'un marché : devis retenu, sinon plus haut devis, sinon estimation. */
export function montantReferenceMarche(
  devis: Array<{ montant_ht: number | null; statut: string; lot?: string | null }>,
  estimationHt: number | null,
): { montant: number | null; source: "devis_retenu" | "devis" | "estimation" | null } {
  const valides = devis.filter((d) => d.montant_ht !== null && d.statut !== "non_retenu");
  const retenus = valides.filter((d) => d.statut === "retenu");
  if (retenus.length) return { montant: retenus.reduce((s, d) => s + Number(d.montant_ht), 0), source: "devis_retenu" };
  if (valides.length) return { montant: Math.max(...valides.map((d) => Number(d.montant_ht))), source: "devis" };
  if (estimationHt && estimationHt > 0) return { montant: estimationHt, source: "estimation" };
  return { montant: null, source: null };
}

/** Fourchette (vocabulaire de l'assistant) correspondant à un montant HT. */
export function fourchetteDeMontant(montantHt: number | null): Fourchette | null {
  if (montantHt === null || !(montantHt > 0)) return null;
  if (montantHt < 20000) return "moins_20k";
  if (montantHt < 100000) return "20k_100k";
  if (montantHt < 500000) return "100k_500k";
  return "plus_500k";
}

/** Seuils du jour (ou de la consultation) au format attendu par encartMarchesPublics. */
export function seuilsPourEncart(seuils: Seuil[], date: string) {
  const t = seuilApplicable(seuils, "travaux", "dispense", date);
  const fs = seuilApplicable(seuils, "fournitures_services", "dispense", date);
  const eu = seuilApplicable(seuils, "travaux", "seuil_europeen", date);
  if (!t || !fs || !eu) return undefined;
  return {
    travaux_dispense_ht: Number(t.montant_ht),
    fournitures_services_dispense_ht: Number(fs.montant_ht),
    travaux_europeen_ht: Number(eu.montant_ht),
    reference: t.reference ?? fs.reference ?? "texte en vigueur",
  };
}
