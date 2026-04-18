import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// POST /api/auth/setup
// Creates commune + profile for newly registered user
// Requires authenticated session (called after email confirmation)
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Check if user already has a profile (idempotent)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, commune_id")
    .eq("id", user.id)
    .single();

  if (existingProfile?.commune_id) {
    return NextResponse.json({ error: "Commune déjà configurée" }, { status: 409 });
  }

  const body = await request.json();
  const { commune_name, code_postal, contact_email, primary_color, accent_color } = body;

  if (!commune_name?.trim()) {
    return NextResponse.json({ error: "Le nom de la commune est requis" }, { status: 400 });
  }

  // Generate a URL-safe slug from commune name
  const slug = commune_name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 50);

  const serviceClient = await createServiceClient();

  // Create commune
  const { data: commune, error: communeError } = await serviceClient
    .from("communes")
    .insert({
      name: commune_name.trim(),
      slug: slug || `commune-${Date.now()}`,
      code_postal: code_postal?.trim() || null,
      contact_email: contact_email?.trim() || user.email || null,
      primary_color: primary_color || "#1a2744",
      accent_color: accent_color || "#c9a84c",
    })
    .select("id, name, slug")
    .single();

  if (communeError) {
    // Slug might be taken — append random suffix
    const fallbackSlug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: commune2, error: communeError2 } = await serviceClient
      .from("communes")
      .insert({
        name: commune_name.trim(),
        slug: fallbackSlug,
        code_postal: code_postal?.trim() || null,
        contact_email: contact_email?.trim() || user.email || null,
        primary_color: primary_color || "#1a2744",
        accent_color: accent_color || "#c9a84c",
      })
      .select("id, name, slug")
      .single();

    if (communeError2) {
      return NextResponse.json(
        { error: "Erreur lors de la création de la commune" },
        { status: 500 }
      );
    }

    // Create profile with fallback commune
    await serviceClient.from("profiles").upsert({
      id: user.id,
      commune_id: commune2!.id,
      full_name: user.user_metadata?.full_name || null,
      role: "admin",
    });

    return NextResponse.json({ success: true, commune: commune2 });
  }

  // Create profile
  const { error: profileError } = await serviceClient.from("profiles").upsert({
    id: user.id,
    commune_id: commune!.id,
    full_name: user.user_metadata?.full_name || null,
    role: "admin",
  });

  if (profileError) {
    return NextResponse.json(
      { error: "Erreur lors de la création du profil" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, commune });
}
