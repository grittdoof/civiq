// Chargement de la fiche projet A4 (serveur). La visibilité des projets
// confidentiels est appliquée par getProject().
import { createServiceClient } from "@/lib/supabase-server";
import { construireFiche, type FicheData, type VarianteFiche } from "./fiche";
import type { LigneBudget, Subvention } from "./financement";
import type { EtapePilotage } from "./pilotage";
import { getCommuneSettings, getProject } from "./queries";
import type { TypeProjetCode } from "./types";

export interface EnveloppeCommune {
  communeName: string;
  communeLogoUrl: string | null;
  editedOn: string;
}

export async function enveloppeCommune(communeId: string): Promise<EnveloppeCommune> {
  const service = await createServiceClient();
  const { data } = await service.from("communes").select("name, logo_url").eq("id", communeId).maybeSingle();
  return {
    communeName: (data?.name as string) ?? "Commune",
    communeLogoUrl: (data?.logo_url as string | null) ?? null,
    editedOn: new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" }),
  };
}

export async function chargerFiche(communeId: string, projectId: string, variante: VarianteFiche): Promise<FicheData | null> {
  const detail = await getProject(communeId, projectId);
  const p = detail.project;
  if (!p) return null;
  const service = await createServiceClient();
  const [{ data: lignes }, { data: delibs }, settings] = await Promise.all([
    service.from("project_budget_lines").select("sens, base, taux_tva, etat, montant_prevu, montant_reel").eq("project_id", projectId).is("deleted_at", null),
    service.from("project_deliberations").select("numero, date_seance, objet").eq("project_id", projectId).is("deleted_at", null).order("date_seance"),
    getCommuneSettings(communeId),
  ]);
  const ext = p as typeof p & {
    commission_pilote_id?: string | null;
    confidentiel?: boolean;
    evenement_debut?: string | null;
    lieu?: string | null;
    emprunt_prevu?: number | null;
    autofinancement_invest?: number | null;
    autofinancement_fonct?: number | null;
  };
  const commission = detail.commissions.find((c) => c.id === ext.commission_pilote_id) ?? detail.commissions[0] ?? null;
  return construireFiche({
    variante,
    projet: {
      titre: p.titre,
      type_code: (p.type_code ?? "suivi_simple") as TypeProjetCode,
      description: p.description,
      photo_url: p.photo_url,
      confidentiel: !!ext.confidentiel,
      avancement_pct: p.avancement_pct ?? null,
      avancement_manuel_pct: p.avancement_manuel_pct ?? null,
      evenement_debut: ext.evenement_debut ?? null,
      lieu: ext.lieu ?? null,
      emprunt_prevu: ext.emprunt_prevu ?? null,
      autofinancement_invest: ext.autofinancement_invest ?? null,
      autofinancement_fonct: ext.autofinancement_fonct ?? null,
    },
    commission: commission?.nom ?? null,
    referent: p.pilote_elu_profile?.full_name ?? null,
    etapes: detail.milestones as unknown as EtapePilotage[],
    lignes: (lignes ?? []) as LigneBudget[],
    subventions: detail.financings as unknown as Array<Subvention & { financeur: string; dispositif?: string | null }>,
    deliberations: (delibs ?? []) as Array<{ numero: string | null; date_seance: string | null; objet: string | null }>,
    documents: detail.documents as unknown as Array<{ nom: string; note_interne?: boolean | null }>,
    tauxFctva: settings.taux_fctva,
  });
}
