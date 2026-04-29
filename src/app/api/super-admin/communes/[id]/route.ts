import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/super-admin/communes/[id] — détail commune + modules + users
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }
  const { id } = await params;
  const service = await createServiceClient();

  const [communeRes, modulesRes, communeModulesRes, profilesRes, authUsersRes, surveyCountRes, responseCountRes] = await Promise.all([
    service.from("communes").select("*").eq("id", id).single(),
    service.from("modules").select("id, name, tagline, icon, category, is_available, is_beta").order("display_order"),
    service.from("commune_modules").select("module_id, activated_at").eq("commune_id", id),
    service.from("profiles").select("id, full_name, role, job_title, created_at").eq("commune_id", id).order("created_at", { ascending: false }),
    service.auth.admin.listUsers(),
    service.from("surveys").select("id", { count: "exact", head: true }).eq("commune_id", id),
    service.from("responses").select("id", { count: "exact", head: true }).eq("commune_id", id),
  ]);

  if (communeRes.error || !communeRes.data) {
    return NextResponse.json({ error: "Commune introuvable" }, { status: 404 });
  }

  const activeIds = new Set((communeModulesRes.data ?? []).map((cm) => cm.module_id));
  const modules = (modulesRes.data ?? []).map((m) => ({ ...m, active: activeIds.has(m.id) }));

  const authUsers = authUsersRes.data?.users ?? [];
  const users = (profilesRes.data ?? []).map((p) => {
    const u = authUsers.find((au) => au.id === p.id);
    return {
      ...p,
      email: u?.email ?? null,
      last_sign_in_at: u?.last_sign_in_at ?? null,
    };
  });

  return NextResponse.json({
    commune: communeRes.data,
    modules,
    users,
    survey_count: surveyCountRes.count ?? 0,
    response_count: responseCountRes.count ?? 0,
  });
}

// POST /api/super-admin/communes/[id] — toggle un module pour la commune
//   body : { module_id, active }
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }
  const { id } = await params;
  const { module_id, active } = await request.json();
  if (!module_id || typeof active !== "boolean") {
    return NextResponse.json({ error: "module_id + active requis" }, { status: 400 });
  }

  const service = await createServiceClient();
  if (active) {
    const { error } = await service
      .from("commune_modules")
      .upsert({ commune_id: id, module_id, activated_by: ctx!.userId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await service
      .from("commune_modules")
      .delete()
      .eq("commune_id", id)
      .eq("module_id", module_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// PATCH /api/super-admin/communes/[id] — archiver / désarchiver / renommer
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, name, code_postal, contact_email } = body;

  const updates: Record<string, unknown> = {};
  if (action === "archive") updates.archived_at = new Date().toISOString();
  if (action === "unarchive") updates.archived_at = null;
  if (name !== undefined) updates.name = name;
  if (code_postal !== undefined) updates.code_postal = code_postal;
  if (contact_email !== undefined) updates.contact_email = contact_email;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service.from("communes").update(updates).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/super-admin/communes/[id] — suppression définitive
// ⚠ Cascade via FK ON DELETE CASCADE : supprime profiles, surveys, responses,
// commune_modules, commune_invitations
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const { id } = await params;
  const service = await createServiceClient();

  // Détacher d'abord les profiles (sinon cascade = perte du compte user)
  await service
    .from("profiles")
    .update({ commune_id: null, role: "viewer" })
    .eq("commune_id", id);

  const { error } = await service.from("communes").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
