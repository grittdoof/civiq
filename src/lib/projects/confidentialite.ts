// ═══════════════════════════════════════════════════════════════
// Projets confidentiels (brief §2.10) — règle de visibilité.
//
// Miroir 1:1 de public.user_voit_projet() (migration 044) : le serveur
// lit en service role (RLS contournée), il DOIT donc appliquer la même
// règle partout où il liste ou ouvre un projet.
//
// Visible : projet non confidentiel ; sinon bureau municipal (admin,
// super_admin) ou personne qui le porte (élu référent, agent,
// contributeur).
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Viewer {
  id: string;
  role: string | null;
}

export interface ProjetVisibilite {
  id: string;
  confidentiel?: boolean | null;
  pilote_elu?: string | null;
  pilote_agent?: string | null;
}

export const estBureau = (role: string | null | undefined) => role === "admin" || role === "super_admin";

export function peutVoirProjet(v: Viewer | null, p: ProjetVisibilite, contributeurs: Iterable<string> = []): boolean {
  if (!p.confidentiel) return true;
  if (!v) return false;
  if (estBureau(v.role)) return true;
  if (v.id === p.pilote_elu || v.id === p.pilote_agent) return true;
  for (const c of contributeurs) if (c === v.id) return true;
  return false;
}

/** Seul le bureau municipal peut marquer ou démarquer un projet confidentiel. */
export const peutChangerConfidentialite = (v: Viewer | null) => !!v && estBureau(v.role);

/** Contributeurs des seuls projets confidentiels (une requête). */
export async function contributeursConfidentiels(
  service: SupabaseClient,
  projets: ProjetVisibilite[],
): Promise<Map<string, string[]>> {
  const ids = projets.filter((p) => p.confidentiel).map((p) => p.id);
  const out = new Map<string, string[]>();
  if (ids.length === 0) return out;
  const { data } = await service.from("project_contributors").select("project_id, profile_id").in("project_id", ids);
  for (const r of data ?? []) {
    const k = r.project_id as string;
    out.set(k, [...(out.get(k) ?? []), r.profile_id as string]);
  }
  return out;
}

/** Filtre une liste de projets selon la règle de confidentialité. */
export async function filtrerProjetsVisibles<T extends ProjetVisibilite>(
  service: SupabaseClient,
  viewer: Viewer | null,
  projets: T[],
): Promise<T[]> {
  if (!projets.some((p) => p.confidentiel)) return projets;
  if (viewer && estBureau(viewer.role)) return projets;
  const contrib = await contributeursConfidentiels(service, projets);
  return projets.filter((p) => peutVoirProjet(viewer, p, contrib.get(p.id) ?? []));
}

/** Le spectateur courant (session), ou null hors session. */
export async function viewerCourant(): Promise<Viewer | null> {
  const { getAuthContext } = await import("@/lib/auth-helpers");
  const ctx = await getAuthContext();
  return ctx ? { id: ctx.userId, role: ctx.role } : null;
}
