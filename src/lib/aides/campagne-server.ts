// ═══════════════════════════════════════════════════════════════
// Alerte de campagne DETR / DSIL (brief §2.9, fonctionnalité prioritaire)
// — côté serveur : détection, destinataires, envoi push + email.
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { projetsSansDemande, messageCampagne, type ProjetCampagne } from "./aides";

export async function projetsCampagne(service: SupabaseClient, communeId: string, annee: number): Promise<ProjetCampagne[]> {
  const { data: projets } = await service
    .from("projects")
    .select("id, titre, type_code, echeance_souhaitee, archived_at, deleted_at, autofinancement_assume, pilote_elu")
    .eq("commune_id", communeId)
    .eq("type_code", "investissement")
    .is("deleted_at", null)
    .is("archived_at", null);
  const ids = (projets ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];
  const { data: fins } = await service
    .from("financings").select("project_id, statut").is("deleted_at", null).in("project_id", ids);
  return projetsSansDemande((projets ?? []) as ProjetCampagne[], (fins ?? []) as Array<{ project_id: string; statut: string }>, annee);
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
