// ═══════════════════════════════════════════════════════════════
// Chargement du portefeuille pour les onglets Projets / Statistiques /
// Reporting (serveur, service role). Une requête par table, jamais par
// projet. Projets confidentiels filtrés par listProjects().
// ═══════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/supabase-server";
import type { LigneBudget } from "./financement";
import { getCommuneSettings, listProjects, type ProjectListItem } from "./queries";
import {
  alertesProjet,
  statutProjet,
  type AlertesProjet,
  type EtapePilotage,
  type ProjetPilotage,
  type StatutProjet,
  type SubventionPilotage,
} from "./pilotage";
import type { TypeProjetCode } from "./types";

export interface Portefeuille {
  items: ProjectListItem[];
  projets: ProjetPilotage[];
  etapesParProjet: Map<string, EtapePilotage[]>;
  lignesParProjet: Map<string, LigneBudget[]>;
  subventionsParProjet: Map<string, SubventionPilotage[]>;
  statuts: Map<string, StatutProjet>;
  alertes: Map<string, AlertesProjet>;
  commissions: Array<{ id: string; nom: string; color: string | null }>;
}

function grouper<T extends { project_id: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(r.project_id, [...(m.get(r.project_id) ?? []), r]);
  return m;
}

export async function chargerPortefeuille(communeId: string): Promise<Portefeuille> {
  const service = await createServiceClient();
  const [items, settings, { data: comms }] = await Promise.all([
    listProjects(communeId),
    getCommuneSettings(communeId),
    service.from("commissions").select("id, nom, color").eq("commune_id", communeId).is("deleted_at", null).eq("active", true).order("nom"),
  ]);
  const commissions = (comms ?? []) as Portefeuille["commissions"];
  const ids = items.map((p) => p.id);
  const vide = { data: [] as never[] };
  const [ms, lignes, fins, devis] = ids.length
    ? await Promise.all([
        service.from("milestones")
          .select("id, project_id, libelle, statut, fait, echeance, date_previsionnelle, date_reelle, est_un_jalon, remonter_au_reporting, commentaire, commentaire_note_interne, ordre, created_at")
          .in("project_id", ids).is("deleted_at", null),
        service.from("project_budget_lines")
          .select("project_id, sens, base, taux_tva, etat, montant_prevu, montant_reel")
          .in("project_id", ids).is("deleted_at", null),
        service.from("financings")
          .select("project_id, statut, montant_demande, montant_obtenu, date_demande, date_ar")
          .in("project_id", ids).is("deleted_at", null),
        service.from("project_quotes")
          .select("project_id, montant_ht, statut, lot")
          .in("project_id", ids).is("deleted_at", null),
      ])
    : [vide, vide, vide, vide];

  const etapesParProjet = grouper((ms.data ?? []) as EtapePilotage[]);
  const lignesParProjet = grouper((lignes.data ?? []) as Array<LigneBudget & { project_id: string }>) as Map<string, LigneBudget[]>;
  const subventionsParProjet = grouper((fins.data ?? []) as SubventionPilotage[]);
  const devisParProjet = grouper((devis.data ?? []) as Array<{ project_id: string; montant_ht: number | null; statut: string; lot: string | null }>);
  const commissionDe = new Map(commissions.map((c) => [c.id, c]));

  const projets: ProjetPilotage[] = items.map((p) => {
    const ext = p as ProjectListItem & {
      commission_pilote_id?: string | null;
      confidentiel?: boolean;
      emprunt_prevu?: number | null;
      autofinancement_invest?: number | null;
      autofinancement_fonct?: number | null;
    };
    // Commission pilote (lot B), à défaut la première commission de suivi.
    const c = (ext.commission_pilote_id && commissionDe.get(ext.commission_pilote_id)) || (p.commissions ?? [])[0] || null;
    return {
      id: p.id,
      titre: p.titre,
      type_code: (p.type_code ?? "suivi_simple") as TypeProjetCode,
      commission: c ? { id: c.id, nom: c.nom, color: c.color ?? null } : null,
      referent: p.pilote_elu_profile ? { id: p.pilote_elu_profile.id, nom: p.pilote_elu_profile.full_name ?? "Sans nom" } : null,
      avancement_pct: p.avancement_pct ?? null,
      avancement_manuel_pct: p.avancement_manuel_pct ?? null,
      confidentiel: !!ext.confidentiel,
      emprunt_prevu: ext.emprunt_prevu ?? null,
      autofinancement_invest: ext.autofinancement_invest ?? null,
      autofinancement_fonct: ext.autofinancement_fonct ?? null,
    };
  });

  const now = new Date();
  const statuts = new Map<string, StatutProjet>();
  const alertes = new Map<string, AlertesProjet>();
  for (const p of projets) {
    const etapes = etapesParProjet.get(p.id) ?? [];
    statuts.set(p.id, statutProjet(etapes));
    alertes.set(p.id, alertesProjet({
      projet: p,
      etapes,
      lignes: lignesParProjet.get(p.id) ?? [],
      subventions: subventionsParProjet.get(p.id) ?? [],
      devis: devisParProjet.get(p.id) ?? [],
      seuilDelegationHt: settings.seuil_delegation_maire_ht,
      tauxFctva: settings.taux_fctva,
      now,
    }));
  }

  return { items, projets, etapesParProjet, lignesParProjet, subventionsParProjet, statuts, alertes, commissions };
}
