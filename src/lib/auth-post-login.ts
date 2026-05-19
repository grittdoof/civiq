/**
 * Logique partagée post-authentification.
 *
 * Appelée depuis :
 *  - /auth/callback (magic link, invitations)
 *  - /auth/post-otp (login OTP 6 chiffres)
 *
 * Responsabilités :
 *  1. Crée le profil s'il manque (rôle "viewer" par défaut)
 *  2. Détermine la redirection cible (setup, dashboard, ou `next`)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface PostLoginResult {
  redirectTo: string;
}

interface PostLoginOptions {
  next?: string | null;
}

export async function resolvePostLoginRedirect(
  service: SupabaseClient,
  userId: string,
  userMetadata: Record<string, unknown>,
  options: PostLoginOptions = {},
): Promise<PostLoginResult> {
  const meta = userMetadata as {
    full_name?: string;
    job_title?: string;
    signup_intent?: string;
  };

  const { data: profile } = await service
    .from("profiles")
    .select("id, commune_id, role")
    .eq("id", userId)
    .maybeSingle();

  // Création de profil si manquant : rôle viewer (administré) par défaut.
  // Le super-admin pourra ensuite promouvoir au rôle admin/editor.
  if (!profile) {
    await service.from("profiles").upsert({
      id: userId,
      full_name: meta.full_name ?? null,
      job_title: meta.job_title ?? "citoyen",
      role: "viewer",
    });
  }

  // Intention « commune » lors du signup → onboarding création de commune
  if (meta.signup_intent === "commune" && !profile?.commune_id) {
    return { redirectTo: "/admin/setup" };
  }

  // Retour vers la page protégée d'origine si elle est interne
  if (options.next && options.next.startsWith("/")) {
    return { redirectTo: options.next };
  }

  return { redirectTo: "/admin/dashboard" };
}
