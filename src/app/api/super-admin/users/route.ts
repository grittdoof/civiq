import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

// GET /api/super-admin/users — tous les utilisateurs avec leur commune
export async function GET() {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const service = await createServiceClient();

  // Récupère les profils avec leur commune
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, role, commune_id, created_at, communes(name, slug)")
    .order("created_at", { ascending: false });

  // Enrichit avec les emails depuis auth.users
  const { data: { users: authUsers } } = await service.auth.admin.listUsers();

  const merged = (profiles ?? []).map((p) => {
    const u = authUsers?.find((au) => au.id === p.id);
    return {
      ...p,
      email: u?.email ?? null,
      last_sign_in_at: u?.last_sign_in_at ?? null,
    };
  });

  return NextResponse.json(merged);
}

// PATCH /api/super-admin/users — modifier le rôle d'un user
export async function PATCH(request: Request) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const { user_id, role } = await request.json();
  if (!user_id || !role) {
    return NextResponse.json({ error: "user_id et role requis" }, { status: 400 });
  }
  if (!["super_admin", "admin", "editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ role })
    .eq("id", user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
