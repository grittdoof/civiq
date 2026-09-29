// ═══════════════════════════════════════════════════════════════
// Corbeille des projets (serveur, service role).
//
//   Mise à la corbeille  → sauvegarde JSON, projects.deleted_at
//   30 jours de corbeille → restauration ou suppression définitive
//                           par le super-administrateur
//   Au-delà de 30 jours   → suppression définitive automatique
//
// Avant toute suppression définitive : sauvegarde JSON complète
// (public.project_snapshot) + copie des pièces jointes et de la photo
// dans le bucket privé `project-archives`, puis public.purge_project().
// Si une copie échoue, la suppression est annulée : rien n'est perdu.
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { estBureau, type Viewer } from "./confidentialite";

export const CORBEILLE_JOURS = 30;
export const BUCKET_ARCHIVES = "project-archives";
const DAY = 86_400_000;

/** Jours restants avant la suppression définitive automatique (≥ 0). */
export function joursRestants(deletedAt: string, now: Date = new Date()): number {
  const fin = Date.parse(deletedAt) + CORBEILLE_JOURS * DAY;
  return Math.max(0, Math.ceil((fin - now.getTime()) / DAY));
}

export function expire(deletedAt: string, now: Date = new Date()): boolean {
  return now.getTime() - Date.parse(deletedAt) >= CORBEILLE_JOURS * DAY;
}

/** Mettre à la corbeille : bureau municipal, ou élu référent / agent du projet. */
export function peutSupprimerProjet(
  v: Viewer | null,
  p: { pilote_elu?: string | null; pilote_agent?: string | null },
): boolean {
  if (!v) return false;
  return estBureau(v.role) || v.id === p.pilote_elu || v.id === p.pilote_agent;
}

type Snapshot = {
  project: { id: string; commune_id: string; titre: string; photo_storage_path?: string | null } | null;
  documents: Array<{ id: string; storage_path: string | null; nom: string }>;
};

export async function snapshotProjet(service: SupabaseClient, projectId: string): Promise<Snapshot & Record<string, unknown>> {
  const { data, error } = await service.rpc("project_snapshot", { p_project_id: projectId });
  if (error || !data) throw new Error(`Sauvegarde impossible : ${error?.message ?? "projet introuvable"}`);
  return data as Snapshot & Record<string, unknown>;
}

/** Écrit la sauvegarde JSON dans les archives ; renvoie son chemin. */
export async function sauvegarderProjet(
  service: SupabaseClient,
  projectId: string,
  motif: "mise_a_la_corbeille" | "suppression_definitive",
): Promise<{ path: string; snapshot: Snapshot & Record<string, unknown> }> {
  const snapshot = await snapshotProjet(service, projectId);
  if (!snapshot.project) throw new Error("Projet introuvable");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${snapshot.project.commune_id}/${projectId}/${stamp}-${motif}.json`;
  const { error } = await service.storage
    .from(BUCKET_ARCHIVES)
    .upload(path, new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }), { contentType: "application/json", upsert: false });
  if (error) throw new Error(`Sauvegarde non écrite : ${error.message}`);
  return { path, snapshot };
}

async function copier(service: SupabaseClient, bucket: string, source: string, destination: string): Promise<void> {
  const { data, error } = await service.storage.from(bucket).download(source);
  if (error || !data) {
    // Fichier déjà absent : rien à préserver.
    if (/not.?found|404/i.test(error?.message ?? "")) return;
    throw new Error(`Copie impossible de ${source} : ${error?.message ?? "inconnue"}`);
  }
  const up = await service.storage.from(BUCKET_ARCHIVES).upload(destination, data, { upsert: true, contentType: data.type || undefined });
  if (up.error) throw new Error(`Archivage impossible de ${source} : ${up.error.message}`);
}

/**
 * Suppression définitive : sauvegarde JSON, copie des fichiers dans les
 * archives, suppression des lignes, puis des fichiers d'origine.
 */
export async function purgerProjet(service: SupabaseClient, projectId: string): Promise<{ sauvegarde: string; fichiers: number }> {
  const { path, snapshot } = await sauvegarderProjet(service, projectId, "suppression_definitive");
  const p = snapshot.project!;
  const base = `${p.commune_id}/${projectId}/fichiers`;
  const docs = (snapshot.documents ?? []).filter((d) => d.storage_path);
  for (const d of docs) await copier(service, "project-documents", d.storage_path!, `${base}/documents/${d.storage_path!.split("/").pop()}`);
  if (p.photo_storage_path) await copier(service, "project-photos", p.photo_storage_path, `${base}/photo/${p.photo_storage_path.split("/").pop()}`);

  const { error } = await service.rpc("purge_project", { p_project_id: projectId });
  if (error) throw new Error(`Suppression définitive refusée : ${error.message}`);

  // Les originaux ne sont retirés qu'une fois les lignes supprimées.
  if (docs.length) await service.storage.from("project-documents").remove(docs.map((d) => d.storage_path!));
  if (p.photo_storage_path) await service.storage.from("project-photos").remove([p.photo_storage_path]);
  return { sauvegarde: path, fichiers: docs.length + (p.photo_storage_path ? 1 : 0) };
}
