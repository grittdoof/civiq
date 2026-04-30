import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

// GET /api/super-admin/rgpd — settings RGPD plateforme
export async function GET() {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }
  const service = await createServiceClient();
  const { data, error } = await service
    .from("platform_settings")
    .select("*")
    .eq("id", "global")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/super-admin/rgpd — mise à jour
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const body = await request.json();
  const allowed = [
    "editor_name", "editor_legal_form", "editor_siret", "editor_address", "editor_email", "editor_phone",
    "legal_rep_name", "legal_rep_role",
    "host_name", "host_address", "host_phone",
    "dpo_name", "dpo_email",
    "cnil_ref", "privacy_email", "retention_default_days",
  ];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k] === "" ? null : body[k];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();
  updates.updated_by = ctx!.userId;

  const service = await createServiceClient();
  const { error } = await service
    .from("platform_settings")
    .update(updates)
    .eq("id", "global");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
