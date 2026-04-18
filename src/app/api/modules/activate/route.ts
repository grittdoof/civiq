import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isCommuneAdmin } from "@/lib/auth-helpers";

// POST /api/modules/activate { module_id } — activer un module pour la commune
export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!isCommuneAdmin(ctx)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const { module_id } = await request.json();
  if (!module_id) return NextResponse.json({ error: "module_id requis" }, { status: 400 });

  const service = await createServiceClient();

  // Vérifier que le module existe et est disponible
  const { data: mod } = await service
    .from("modules")
    .select("id, is_available")
    .eq("id", module_id)
    .single();

  if (!mod || !mod.is_available) {
    return NextResponse.json({ error: "Module indisponible" }, { status: 404 });
  }

  const { error } = await service
    .from("commune_modules")
    .upsert({
      commune_id: ctx!.communeId,
      module_id,
      activated_by: ctx!.userId,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/modules/activate?module_id=xxx — désactiver un module
export async function DELETE(request: Request) {
  const ctx = await getAuthContext();
  if (!isCommuneAdmin(ctx)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const url = new URL(request.url);
  const moduleId = url.searchParams.get("module_id");
  if (!moduleId) return NextResponse.json({ error: "module_id requis" }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service
    .from("commune_modules")
    .delete()
    .eq("commune_id", ctx!.communeId!)
    .eq("module_id", moduleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
