import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Vérifier si l'utilisateur a déjà un profil + une commune
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, commune_id")
          .eq("id", user.id)
          .single();

        // Nouveau user (pas de profil ou pas de commune) → setup
        if (!profile || !profile.commune_id) {
          return NextResponse.redirect(`${origin}/admin/setup`);
        }
      }

      return NextResponse.redirect(`${origin}/admin/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth`);
}
