import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// GET /api/auth/me — retourne le profil + commune de l'utilisateur connecté
// Utilise le service client pour bypass le RLS récursif sur profiles
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const service = await createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("id, full_name, role, commune_id, communes(id, name, slug, primary_color, accent_color, code_postal, contact_email, website_url)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    full_name: profile.full_name,
    role: profile.role,
    commune_id: profile.commune_id,
    commune: profile.communes ?? null,
  });
}
