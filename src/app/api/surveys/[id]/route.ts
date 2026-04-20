import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import type { SurveySchema } from "@/types/survey";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/surveys/[id]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Service client → bypass RLS récursif sur profiles
  const service = await createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("commune_id")
    .eq("id", user.id)
    .single();

  if (!profile?.commune_id) {
    return NextResponse.json({ error: "Aucune commune associée" }, { status: 403 });
  }

  const { data: survey, error } = await service
    .from("surveys")
    .select("*")
    .eq("id", id)
    .eq("commune_id", profile.commune_id)
    .single();

  if (!survey || error) {
    return NextResponse.json({ error: "Sondage introuvable" }, { status: 404 });
  }

  return NextResponse.json(survey);
}

// PATCH /api/surveys/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Service client → bypass RLS récursif sur profiles
  const service = await createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("commune_id, role")
    .eq("id", user.id)
    .single();

  if (
    !profile?.commune_id ||
    !["admin", "super_admin", "editor"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  // Vérifier que le sondage appartient à cette commune
  const { data: existing } = await service
    .from("surveys")
    .select("id, commune_id")
    .eq("id", id)
    .eq("commune_id", profile.commune_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Sondage introuvable" }, { status: 404 });
  }

  const body = await request.json();
  const {
    title,
    description,
    schema,
    status,
    starts_at,
    ends_at,
    max_responses,
    custom_header_text,
    custom_thank_you,
    allow_anonymous,
    require_email,
  } = body;

  // Valider le schema si fourni
  if (schema) {
    const s = schema as SurveySchema;
    if (!s.steps || !Array.isArray(s.steps)) {
      return NextResponse.json({ error: "Schema invalide" }, { status: 400 });
    }
  }

  const allowedStatuses = ["draft", "published", "closed", "archived"];
  if (status && !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (schema !== undefined) updates.schema = schema;
  if (status !== undefined) {
    updates.status = status;
    if (status === "published") updates.published_at = new Date().toISOString();
  }
  if (starts_at !== undefined) updates.starts_at = starts_at;
  if (ends_at !== undefined) updates.ends_at = ends_at;
  if (max_responses !== undefined) updates.max_responses = max_responses;
  if (custom_header_text !== undefined) updates.custom_header_text = custom_header_text;
  if (custom_thank_you !== undefined) updates.custom_thank_you = custom_thank_you;
  if (allow_anonymous !== undefined) updates.allow_anonymous = allow_anonymous;
  if (require_email !== undefined) updates.require_email = require_email;

  const { data: survey, error } = await service
    .from("surveys")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(survey);
}

// DELETE /api/surveys/[id]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Service client → bypass RLS récursif sur profiles
  const service = await createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("commune_id, role")
    .eq("id", user.id)
    .single();

  if (
    !profile?.commune_id ||
    !["admin", "super_admin", "editor"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const { error } = await service
    .from("surveys")
    .delete()
    .eq("id", id)
    .eq("commune_id", profile.commune_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
