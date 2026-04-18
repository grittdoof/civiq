import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/surveys — liste des sondages de la commune
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Récupérer le profil pour connaître la commune
  const { data: profile } = await supabase
    .from("profiles")
    .select("commune_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.commune_id) {
    return NextResponse.json({ error: "Aucune commune associée" }, { status: 403 });
  }

  const { data: surveys, error } = await supabase
    .from("surveys")
    .select("*, responses(count)")
    .eq("commune_id", profile.commune_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(surveys);
}

// POST /api/surveys — créer un sondage
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("commune_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.commune_id || !["admin", "super_admin", "editor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const body = await request.json();
  const { title, slug, description, schema, template_id } = body;

  // Si template_id, charger le schema du template
  let surveySchema = schema;
  if (template_id && !schema) {
    const { data: template } = await supabase
      .from("survey_templates")
      .select("schema")
      .eq("id", template_id)
      .single();

    if (template) surveySchema = template.schema;
  }

  const { data: survey, error } = await supabase
    .from("surveys")
    .insert({
      commune_id: profile.commune_id,
      title,
      slug: slug || title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description,
      schema: surveySchema || { steps: [], settings: {} },
      created_by: user.id,
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(survey, { status: 201 });
}
