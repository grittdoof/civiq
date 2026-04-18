import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

// GET /api/super-admin/modules — tous les modules de la plateforme
export async function GET() {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const service = await createServiceClient();
  const { data: modules } = await service
    .from("modules")
    .select("*")
    .order("display_order");

  // Compter les activations par module
  const { data: activations } = await service
    .from("commune_modules")
    .select("module_id");

  const counts: Record<string, number> = {};
  (activations ?? []).forEach((a) => {
    counts[a.module_id] = (counts[a.module_id] ?? 0) + 1;
  });

  const enriched = (modules ?? []).map((m) => ({
    ...m,
    activation_count: counts[m.id] ?? 0,
  }));

  return NextResponse.json(enriched);
}

// PATCH — basculer disponibilité ou beta d'un module
export async function PATCH(request: Request) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const { module_id, is_available, is_beta } = await request.json();
  if (!module_id) {
    return NextResponse.json({ error: "module_id requis" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (is_available !== undefined) updates.is_available = is_available;
  if (is_beta !== undefined) updates.is_beta = is_beta;

  const service = await createServiceClient();
  const { error } = await service.from("modules").update(updates).eq("id", module_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
