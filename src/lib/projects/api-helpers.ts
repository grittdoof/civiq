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
