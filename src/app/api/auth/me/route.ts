import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// GET /api/auth/me — profil + commune + modules activés + rôle
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const service = await createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select(`
      id, full_name, role, commune_id,
      communes(id, name, slug, primary_color, accent_color, code_postal, contact_email, website_url, logo_url)
    `)
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({
      id: user.id,
      email: user.email,
      full_name: null,
      role: null,
      commune_id: null,
      commune: null,
      modules: [],
    });
  }

  // Modules activés pour la commune
  let modules: { id: string; name: string; icon: string; category: string }[] = [];
  if (profile.commune_id) {
    const { data: cms } = await service
      .from("commune_modules")
      .select("module_id, modules(id, name, icon, category, tagline)")
      .eq("commune_id", profile.commune_id);

    if (cms) {
      modules = cms
        .map((cm) => cm.modules as unknown as { id: string; name: string; icon: string; category: string; tagline: string })
        .filter(Boolean);
    }
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    full_name: profile.full_name,
    role: profile.role,
    is_super_admin: profile.role === "super_admin",
    commune_id: profile.commune_id,
    commune: profile.communes ?? null,
    modules,
  });
}
