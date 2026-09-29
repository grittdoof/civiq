// ═══════════════════════════════════════════════════════════════
// Plan pluriannuel d'investissement (PPI) — logique pure, commune à la
// page /admin/projects/ppi et à son export PDF.
//
// • Seuls les projets de type investissement (hors « accompagnement
//   sans financement ») ; exclusion manuelle via projects.in_ppi.
// • Année de programmation : échéance souhaitée, à défaut année de
//   création.
// • Montant HT : budget prévu (lignes budgétaires, en HT), à défaut
//   l'enveloppe estimée de l'ancienne interface.
// • Sollicité = demandes déposées ; obtenu = accordé ou versé ;
//   reste à charge = montant HT − obtenu.
// ═══════════════════════════════════════════════════════════════

import { avancementAffiche } from "./etapes";
import { totauxBudget, type LigneBudget } from "./financement";
import type { StatutProjet, SubventionPilotage } from "./pilotage";

export interface ProjetPpiSource {
  id: string;
  titre: string;
  type_code?: string | null;
  accompagne_sans_financer?: boolean | null;
  in_ppi?: boolean | null;
  echeance_souhaitee?: string | null;
  date_creation?: string | null;
  budget_estime?: number | null;
  concerne_tiers?: boolean | null;
  tiers_nom?: string | null;
  avancement_pct?: number | null;
  avancement_manuel_pct?: number | null;
}

export interface LignePpi {
  id: string;
  titre: string;
  etat: string;
  tiers: string | null;
  montantHt: number;
  sollicite: number;
  obtenu: number;
  reste: number;
  /** Montant repris de l'ancienne enveloppe estimée (aucune ligne budgétaire). */
  estimation: boolean;
}

export interface Ppi {
  annees: Array<{ annee: number; lignes: LignePpi[]; total: { montantHt: number; sollicite: number; obtenu: number; reste: number } }>;
  exclus: LignePpi[];
  total: { operations: number; montantHt: number; sollicite: number; obtenu: number; reste: number };
}

const DEPOSEES = ["demandee", "ar_recu", "accordee", "soldee"];
const r2 = (n: number) => Math.round(n * 100) / 100;

export function anneeProgrammation(p: Pick<ProjetPpiSource, "echeance_souhaitee" | "date_creation">, now = new Date()): number {
  const src = p.echeance_souhaitee ?? p.date_creation;
  const y = src ? Number(src.slice(0, 4)) : NaN;
  return Number.isFinite(y) ? y : now.getUTCFullYear();
}

function ligne(p: ProjetPpiSource, lignes: LigneBudget[], subs: SubventionPilotage[], statut: StatutProjet | undefined): LignePpi {
  const prevu = totauxBudget(lignes, "ht").prevu;
  const estimation = !(prevu > 0);
  const montantHt = estimation ? Number(p.budget_estime ?? 0) : prevu;
  let sollicite = 0, obtenu = 0;
  for (const s of subs) {
    if (DEPOSEES.includes(s.statut)) sollicite += Number(s.montant_demande ?? 0);
    if (s.statut === "accordee" || s.statut === "soldee") obtenu += Number(s.montant_obtenu ?? s.montant_demande ?? 0);
  }
  const a = avancementAffiche(p).pct;
  return {
    id: p.id,
    titre: p.titre,
    etat: statut === "termine" ? "Terminé" : a === null ? "Avancement non renseigné" : `Avancement ${Math.round(a)} %`,
    tiers: p.concerne_tiers ? p.tiers_nom ?? "Tiers" : null,
    montantHt: r2(montantHt),
    sollicite: r2(sollicite),
    obtenu: r2(obtenu),
    reste: r2(montantHt - obtenu),
    estimation,
  };
}

export function construirePpi(input: {
  projets: ProjetPpiSource[];
  lignesParProjet: Map<string, LigneBudget[]>;
  subventionsParProjet: Map<string, SubventionPilotage[]>;
  statuts: Map<string, StatutProjet>;
  now?: Date;
}): Ppi {
  const eligibles = input.projets.filter((p) => p.type_code === "investissement" && !p.accompagne_sans_financer);
  const mk = (p: ProjetPpiSource) => ligne(p, input.lignesParProjet.get(p.id) ?? [], input.subventionsParProjet.get(p.id) ?? [], input.statuts.get(p.id));
  const parAnnee = new Map<number, LignePpi[]>();
  for (const p of eligibles.filter((x) => x.in_ppi !== false)) {
    const y = anneeProgrammation(p, input.now);
    parAnnee.set(y, [...(parAnnee.get(y) ?? []), mk(p)]);
  }
  const somme = (l: LignePpi[]) => ({
    montantHt: r2(l.reduce((s, x) => s + x.montantHt, 0)),
    sollicite: r2(l.reduce((s, x) => s + x.sollicite, 0)),
    obtenu: r2(l.reduce((s, x) => s + x.obtenu, 0)),
    reste: r2(l.reduce((s, x) => s + x.reste, 0)),
  });
  const annees = [...parAnnee.entries()]
    .sort(([a], [b]) => a - b)
    .map(([annee, lignes]) => ({ annee, lignes: lignes.sort((a, b) => a.titre.localeCompare(b.titre, "fr")), total: somme(lignes) }));
  const toutes = annees.flatMap((a) => a.lignes);
  return {
    annees,
    exclus: eligibles.filter((p) => p.in_ppi === false).map(mk),
    total: { operations: toutes.length, ...somme(toutes) },
  };
}
