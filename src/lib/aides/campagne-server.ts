// ═══════════════════════════════════════════════════════════════
// Alerte de campagne DETR / DSIL (brief §2.9, fonctionnalité prioritaire)
// — côté serveur : détection, destinataires, envoi push + email.
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { projetsSansDemande, messageCampagne, type ProjetCampagne } from "./aides";
import { filtrerProjetsVisibles, type Viewer } from "@/lib/projects/confidentialite";

/**
 * `viewer` : projets confidentiels filtrés pour ce spectateur (bandeau de
 * la page). `null` (tâche planifiée, envoi collectif) : projets
 * confidentiels exclus — leur titre ne part jamais dans un envoi groupé.
 */
export async function projetsCampagne(service: SupabaseClient, communeId: string, annee: number, viewer: Viewer | null = null): Promise<ProjetCampagne[]> {
  const { data: projets } = await service
    .from("projects")
    .select("id, titre, type_code, echeance_souhaitee, archived_at, deleted_at, autofinancement_assume, pilote_elu, pilote_agent, confidentiel")
    .eq("commune_id", communeId)
    .eq("type_code", "investissement")
    .is("deleted_at", null)
    .is("archived_at", null);
  type Row = ProjetCampagne & { id: string; confidentiel: boolean; pilote_elu: string | null; pilote_agent: string | null };
  const lignes = (projets ?? []) as Row[];
  const visibles = viewer ? await filtrerProjetsVisibles(service, viewer, lignes) : lignes.filter((p) => !p.confidentiel);
  const ids = visibles.map((p) => p.id);
  if (ids.length === 0) return [];
  const { data: fins } = await service
    .from("financings").select("project_id, statut").is("deleted_at", null).in("project_id", ids);
  return projetsSansDemande(visibles, (fins ?? []) as Array<{ project_id: string; statut: string }>, annee);
}

/** Élus référents des projets concernés + maire(s) de la commune. */
export async function destinatairesCampagne(service: SupabaseClient, communeId: string, projetIds: string[]): Promise<string[]> {
  const [{ data: projets }, { data: maires }] = await Promise.all([
    service.from("projects").select("pilote_elu").in("id", projetIds),
    service.from("profiles").select("id").eq("commune_id", communeId).eq("job_title", "maire"),
  ]);
  const ids = new Set<string>();
  for (const p of projets ?? []) if (p.pilote_elu) ids.add(p.pilote_elu as string);
  for (const m of maires ?? []) ids.add(m.id as string);
  return [...ids];
}

export { messageCampagne };
