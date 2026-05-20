import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

// ═══════════════════════════════════════════════════════════════
// POST /api/super-admin/users/[id]/modules
//   body : { module_id, enabled }
//
// Active ou désactive un module spécifique pour un utilisateur précis.
//   - enabled=true  → suppression de l'override (retour au défaut = actif si
//                     la commune a le module et le rôle est admin/editor)
//   - enabled=false → insertion d'un override "disabled"
// ═══════════════════════════════════════════════════════════════

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }
  const { id: userId } = await params;
  const body = await request.json().catch(() => null);
  const { module_id, enabled } = body || {};

  if (!module_id || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "module_id + enabled requis" }, { status: 400 });
  }

  const service = await createServiceClient();

  if (enabled) {
    // Retour au défaut : on supprime l'override
    const { error } = await service
      .from("profile_module_overrides")
      .delete()
      .eq("profile_id", userId)
      .eq("module_id", module_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Désactivation explicite : upsert avec enabled=false
    const { error } = await service
      .from("profile_module_overrides")
      .upsert({
        profile_id: userId,
        module_id,
        enabled: false,
        updated_by: ctx!.userId,
        updated_at: new Date().toISOString(),
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
