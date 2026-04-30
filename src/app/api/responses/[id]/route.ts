import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// API individuelle d'une réponse
//   PATCH  : modifier la donnée (data) d'une réponse
//   DELETE : supprimer une réponse
//
// Restreint aux admins/editors de la commune qui détient la réponse.
// Les super-admins ont accès à toutes les communes.
// ═══════════════════════════════════════════════════════════════

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function authorize(responseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }

  const service = await createServiceClient();
  const [profileRes, responseRes] = await Promise.all([
    service.from("profiles").select("role, commune_id").eq("id", user.id).single(),
    service.from("responses").select("commune_id, survey_id").eq("id", responseId).single(),
  ]);

  if (!profileRes.data) {
    return { ok: false as const, response: NextResponse.json({ error: "Profil introuvable" }, { status: 403 }) };
  }
  if (!responseRes.data) {
    return { ok: false as const, response: NextResponse.json({ error: "Réponse introuvable" }, { status: 404 }) };
  }

  const profile = profileRes.data;
  const resp = responseRes.data;

  const isSuperAdmin = profile.role === "super_admin";
  const sameCommune = profile.commune_id === resp.commune_id;
  const allowedRole = ["admin", "editor"].includes(profile.role);

  if (!isSuperAdmin && !(sameCommune && allowedRole)) {
    return { ok: false as const, response: NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 }) };
  }

  return { ok: true as const, service, profile, response: resp };
}

// PATCH /api/responses/[id] — modifier la data d'une réponse
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await authorize(id);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.data !== undefined) {
    if (typeof body.data !== "object" || Array.isArray(body.data) || body.data === null) {
      return NextResponse.json({ error: "Format de données invalide" }, { status: 400 });
    }
    updates.data = body.data;
  }
  if (body.respondent_name !== undefined) updates.respondent_name = body.respondent_name || null;
  if (body.respondent_email !== undefined) updates.respondent_email = body.respondent_email || null;
  if (body.respondent_phone !== undefined) updates.respondent_phone = body.respondent_phone || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const { error } = await auth.service.from("responses").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE /api/responses/[id]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await authorize(id);
  if (!auth.ok) return auth.response;

  const { error } = await auth.service.from("responses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
