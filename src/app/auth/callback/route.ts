import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { resolvePostLoginRedirect } from "@/lib/auth-post-login";

// ═══════════════════════════════════════════════════════════════
// /auth/callback
//
// Garde le flow magic-link pour les invitations (commune_invitations
// envoie encore des liens). Pour le login standard on utilise désormais
// l'OTP 6 chiffres → /auth/post-otp.
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
  const { redirectTo } = await resolvePostLoginRedirect(
    service,
    user.id,
    user.user_metadata || {},
    { next },
  );

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
