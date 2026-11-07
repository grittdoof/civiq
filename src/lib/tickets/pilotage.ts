// ═══════════════════════════════════════════════════════════════
// Pilotage des interventions (lot 4, maquette 4B) — logique pure.
//
// Règles de confidentialité des tableaux de bord :
//   • confidentiels : jamais comptés ni affichés ;
//   • restreints que la personne ne peut pas ouvrir : comptés (dans sa
//     portée), jamais listés ni détaillés.
// La sélection de ces tickets est faite côté serveur (pilotage-server).
// ═══════════════════════════════════════════════════════════════

import type { Urgence } from "./categories";

export type Periode = "7j" | "30j" | "trimestre" | "annee";
export const PERIODES: Array<{ valeur: Periode; libelle: string; jours: number }> = [
  { valeur: "7j", libelle: "7 jours", jours: 7 },
  { valeur: "30j", libelle: "30 jours", jours: 30 },
  { valeur: "trimestre", libelle: "Trimestre", jours: 91 },
  { valeur: "annee", libelle: "Année", jours: 365 },
];

export function bornesPeriode(p: Periode, maintenant = new Date()): { debut: Date; fin: Date; debutPrecedente: Date } {
  const jours = PERIODES.find((x) => x.valeur === p)?.jours ?? 30;
  const fin = maintenant;
  const debut = new Date(fin.getTime() - jours * 86_400_000);
  const debutPrecedente = new Date(debut.getTime() - jours * 86_400_000);
  return { debut, fin, debutPrecedente };
}

export interface TicketPilotage {
  id: string;
  numero: number;
  statut: string;
  urgence: Urgence;
  created_at: string;
  pris_en_charge_at: string | null;
  clos_at: string | null;
  resolu_at: string | null;
  delai_cible_le: string | null;
  service_id: string | null;
  categorie_id: string | null;
  /** Catégorie racine (pour les regroupements). */
  categorie_racine_id: string | null;
  /** Vrai si la personne ne peut pas ouvrir ce ticket (restreint) : compté, jamais détaillé. */
  masque: boolean;
}

const OUVERTS = new Set(["nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente"]);
export const ouvert = (t: { statut: string }) => OUVERTS.has(t.statut);
const fermeLe = (t: TicketPilotage) => t.clos_at ?? t.resolu_at;
const ms = (iso: string) => new Date(iso).getTime();

export function enRetard(t: TicketPilotage, maintenant = new Date()): boolean {
  return ouvert(t) && !!t.delai_cible_le && ms(t.delai_cible_le) < maintenant.getTime();
}

/** Ticket « danger immédiat » toujours pas pris en charge. */
export function dangerNonPrisEnCharge(t: TicketPilotage): boolean {
  return ouvert(t) && t.urgence === "danger_immediat" && !t.pris_en_charge_at && (t.statut === "nouveau" || t.statut === "assigne");
}

/** Ticket sans aucune prise en charge depuis plus de `jours`. */
export function sansReponse(t: TicketPilotage, jours: number, maintenant = new Date()): boolean {
  return ouvert(t) && !t.pris_en_charge_at && (t.statut === "nouveau" || t.statut === "assigne")
    && maintenant.getTime() - ms(t.created_at) > jours * 86_400_000;
}

/** Délai moyen de traitement (jours, 1 décimale) des tickets clôturés dans la liste. */
export function delaiMoyenJours(tickets: TicketPilotage[]): number | null {
  const durees = tickets.map((t) => { const f = fermeLe(t); return f ? ms(f) - ms(t.created_at) : null; })
    .filter((d): d is number => d !== null && d >= 0);
  if (durees.length === 0) return null;
  return Math.round((durees.reduce((a, b) => a + b, 0) / durees.length / 86_400_000) * 10) / 10;
}

export function formatJours(j: number | null): string {
  if (j === null) return "—";
  return `${j.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`;
}

export interface Indicateurs {
  ouverts: number;
  enCours: number;
  enRetard: number;
  clotures: number;
  cloturesPrecedente: number;
  crees: number;
  creesPrecedente: number;
  delaiMoyen: number | null;
  /** Part des tickets créés sur la période pris en charge en moins de 24 h (%). */
  priseEnCharge24h: number | null;
  masques: number;
}

export function indicateurs(tickets: TicketPilotage[], p: Periode, maintenant = new Date()): Indicateurs {
  const { debut, debutPrecedente } = bornesPeriode(p, maintenant);
  const dans = (iso: string | null, a: Date, b: Date) => !!iso && ms(iso) >= a.getTime() && ms(iso) < b.getTime();
  const clos = tickets.filter((t) => !ouvert(t) && dans(fermeLe(t), debut, maintenant));
  const crees = tickets.filter((t) => dans(t.created_at, debut, maintenant));
  const avec24 = crees.filter((t) => t.pris_en_charge_at);
  return {
    ouverts: tickets.filter(ouvert).length,
    enCours: tickets.filter((t) => t.statut === "pris_en_charge" || t.statut === "en_cours").length,
    enRetard: tickets.filter((t) => enRetard(t, maintenant)).length,
    clotures: clos.length,
    cloturesPrecedente: tickets.filter((t) => !ouvert(t) && dans(fermeLe(t), debutPrecedente, debut)).length,
    crees: crees.length,
    creesPrecedente: tickets.filter((t) => dans(t.created_at, debutPrecedente, debut)).length,
    delaiMoyen: delaiMoyenJours(clos),
    priseEnCharge24h: crees.length === 0 ? null
      : Math.round((avec24.filter((t) => ms(t.pris_en_charge_at!) - ms(t.created_at) <= 86_400_000).length / crees.length) * 100),
    masques: tickets.filter((t) => t.masque).length,
  };
}

export interface LigneTableau {
  cle: string;
  libelle: string;
  ouverts: number;
  enCours: number;
  enRetard: number;
  delaiMoyen: number | null;
  clotures: number;
  crees: number;
  creesPrecedente: number;
}

/**
 * Tableau regroupé (par service ou par catégorie). `cleDe` renvoie la
 * clé de regroupement (null = « Sans service » / « Sans catégorie »).
 */
export function tableau(
  tickets: TicketPilotage[], p: Periode,
  cleDe: (t: TicketPilotage) => string | null,
  libelleDe: (cle: string | null) => string,
  maintenant = new Date(),
): LigneTableau[] {
  const groupes = new Map<string, TicketPilotage[]>();
  for (const t of tickets) {
    const k = cleDe(t) ?? "__aucun";
    groupes.set(k, [...(groupes.get(k) ?? []), t]);
  }
  return [...groupes.entries()].map(([cle, liste]) => {
    const i = indicateurs(liste, p, maintenant);
    return {
      cle, libelle: libelleDe(cle === "__aucun" ? null : cle),
      ouverts: i.ouverts, enCours: i.enCours, enRetard: i.enRetard, delaiMoyen: i.delaiMoyen,
      clotures: i.clotures, crees: i.crees, creesPrecedente: i.creesPrecedente,
    };
  }).sort((a, b) => b.ouverts - a.ouverts || b.crees - a.crees || a.libelle.localeCompare(b.libelle, "fr"));
}

/** « En hausse : +9 », « En baisse : −2 », « Stable ». */
export function tendance(maintenant: number, avant: number): { texte: string; sens: "hausse" | "baisse" | "stable" } {
  const d = maintenant - avant;
  if (d === 0) return { texte: "Stable", sens: "stable" };
  return d > 0 ? { texte: `En hausse : +${d}`, sens: "hausse" } : { texte: `En baisse : −${-d}`, sens: "baisse" };
}

export interface Alertes<T extends TicketPilotage = TicketPilotage> {
  danger: T[];
  sansReponse: T[];
  enRetard: T[];
}

/** Alertes listables : jamais de ticket masqué. */
export function alertes<T extends TicketPilotage>(tickets: T[], joursSansReponse: number, maintenant = new Date()): Alertes<T> {
  const visibles = tickets.filter((t) => !t.masque);
  return {
    danger: visibles.filter(dangerNonPrisEnCharge),
    sansReponse: visibles.filter((t) => !dangerNonPrisEnCharge(t) && sansReponse(t, joursSansReponse, maintenant)),
    enRetard: visibles.filter((t) => enRetard(t, maintenant)),
  };
}

/** Lignes CSV (séparateur « ; », guillemets doublés), pour Excel en français. */
export function versCsv(entetes: string[], lignes: Array<Array<string | number | null>>): string {
  const cell = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? v.toLocaleString("fr-FR") : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [entetes, ...lignes].map((l) => l.map(cell).join(";")).join("\r\n");
}
