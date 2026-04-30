import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// /auth/callback
//
// Logique :
//   1. Échange le code OAuth/magic link contre une session
//   2. Si le profil n'existe pas → on le crée avec role=viewer
//      (le rôle par défaut « administré ») et les métadonnées
//      (full_name, job_title) éventuellement passées au signup
//   3. Si on a un signup_intent=commune dans la metadata → /admin/setup
//   4. Sinon → /admin/dashboard (l'admin ou la commune apparaîtra
//      lorsque la commune sera attribuée par un super-admin)
// ═══════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/auth/login?error=auth`);

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, commune_id, role")
    .eq("id", user.id)
    .maybeSingle();

  const meta = (user.user_metadata || {}) as { full_name?: string; job_title?: string; signup_intent?: string };

  // Création de profil si manquant : rôle « viewer » (administré) par défaut.
  // Le super-admin pourra ensuite promouvoir au rôle admin/editor selon le besoin.
  if (!profile) {
    await service.from("profiles").upsert({
      id: user.id,
      full_name: meta.full_name ?? null,
      job_title: meta.job_title ?? "citoyen",
      role: "viewer",
    });
  }

  // Intention « commune » lors du signup → onboarding création de commune
  if (meta.signup_intent === "commune" && !profile?.commune_id) {
    return NextResponse.redirect(`${origin}/admin/setup`);
  }

  // Si l'utilisateur revient depuis une page protégée
  if (next && next.startsWith("/")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/admin/dashboard`);
}
