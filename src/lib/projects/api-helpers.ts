import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// Helpers d'auth pour les routes API projet :
//   • requireProjectAccess(projectId) — vérifie module + ownership
//     commune. Retourne { ok, communeId, role, userId } ou NextResponse.
//   • requireProjectEdit(projectId) — comme ci-dessus + rôle en
//     écriture (admin/editor/super_admin).
// ═══════════════════════════════════════════════════════════════

export type ProjectAccess =
  | { ok: true; communeId: string; role: string; userId: string }
  | { ok: false; response: NextResponse };

export async function requireProjectAccess(projectId: string): Promise<ProjectAccess> {
  const guard = await requireModule("projects");
  if (!guard.ok) return { ok: false, response: guard.response };
  if (!guard.communeId) {
    return { ok: false, response: NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 }) };
  }

  const service = await createServiceClient();
  const { data } = await service
    .from("projects")
    .select("id, commune_id")
    .is("deleted_at", null)
    .eq("id", projectId)
    .maybeSingle();

  if (!data) {
    return { ok: false, response: NextResponse.json({ error: "Projet introuvable" }, { status: 404 }) };
  }
  if (data.commune_id !== guard.communeId && !guard.isSuperAdmin) {
    return { ok: false, response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }

  return { ok: true, communeId: data.commune_id, role: guard.role, userId: guard.userId };
}

export async function requireProjectEdit(projectId: string): Promise<ProjectAccess> {
  const access = await requireProjectAccess(projectId);
  if (!access.ok) return access;
  if (!["admin", "editor", "super_admin"].includes(access.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 }),
    };
  }
  return access;
}

// ═══════════════════════════════════════════════════════════════
// Commissions / séances : même principe. Les routes utilisent le
// service role (bypass RLS) → l'appartenance commission → commune
// et séance → commission DOIT être vérifiée ici, sinon un éditeur
// d'une commune peut agir sur les données d'une autre.
// ═══════════════════════════════════════════════════════════════

export type CommissionAccess = ProjectAccess;

const EDIT_ROLES = ["admin", "editor", "super_admin"];

export async function requireCommissionEdit(commissionId: string): Promise<CommissionAccess> {
  const guard = await requireModule("projects");
  if (!guard.ok) return { ok: false, response: guard.response };
  if (!guard.communeId) {
    return { ok: false, response: NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 }) };
  }
  if (!EDIT_ROLES.includes(guard.role)) {
    return { ok: false, response: NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 }) };
  }

  const service = await createServiceClient();
  const { data } = await service
    .from("commissions")
    .select("id, commune_id")
    .is("deleted_at", null)
    .eq("id", commissionId)
    .maybeSingle();

  if (!data) {
    return { ok: false, response: NextResponse.json({ error: "Commission introuvable" }, { status: 404 }) };
  }
  if (data.commune_id !== guard.communeId && !guard.isSuperAdmin) {
    return { ok: false, response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }

  return { ok: true, communeId: data.commune_id, role: guard.role, userId: guard.userId };
}

/** Vérifie en plus que la séance appartient bien à la commission. */
export async function requireSessionEdit(commissionId: string, sessionId: string): Promise<CommissionAccess> {
  const access = await requireCommissionEdit(commissionId);
  if (!access.ok) return access;

  const service = await createServiceClient();
  const { data } = await service
    .from("commission_sessions")
    .select("id")
    .is("deleted_at", null)
    .eq("id", sessionId)
    .eq("commission_id", commissionId)
    .maybeSingle();
  if (!data) {
    return { ok: false, response: NextResponse.json({ error: "Séance introuvable" }, { status: 404 }) };
  }
  return access;
}

/** Le projet doit appartenir à la commune donnée (liaisons cross-tables). */
export async function projectBelongsToCommune(projectId: string, communeId: string): Promise<boolean> {
  const service = await createServiceClient();
  const { data } = await service
    .from("projects")
    .select("id")
    .is("deleted_at", null)
    .eq("id", projectId)
    .eq("commune_id", communeId)
    .maybeSingle();
  return !!data;
}
