import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { resolvePostLoginRedirect } from "@/lib/auth-post-login";

/**
 * POST /api/auth/post-otp
 *
 * Appelé par la page /auth/login après un verifyOtp réussi côté client.
 * Crée le profil si nécessaire et renvoie l'URL de redirection.
 *
 * Body (JSON, optionnel) :
 *   { next?: string }   — page protégée d'origine
 */
export async function POST(request: Request) {
  let next: string | null = null;
  try {
    const body = await request.json().catch(() => null) as { next?: string } | null;
    next = body?.next ?? null;
  } catch { /* no-op */ }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const service = await createServiceClient();
  const { redirectTo } = await resolvePostLoginRedirect(
    service,
    user.id,
    user.user_metadata || {},
    { next },
  );

  return NextResponse.json({ redirectTo });
}
