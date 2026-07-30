/**
 * Logique partagée post-authentification.
 *
 * Appelée depuis :
 *  - /auth/callback (magic link, invitations)
 *  - /auth/post-otp (login OTP 6 chiffres)
 *
 * Responsabilités :
 *  1. Crée le profil s'il manque (rôle "viewer" par défaut)
 *  2. Si l'utilisateur a signalé une intention commune au signup
 *     (metadata signup_intent='commune'), crée automatiquement un
 *     commune_request status='pending' → le super-admin le voit
 *     immédiatement dans /super-admin/commune-requests.
 *  3. Détermine la redirection cible :
 *     - Intention commune → /admin/onboarding (page qui explique le
 *       statut pending et permet d'annuler ou d'ajuster la demande)
 *     - Sinon → /admin/dashboard ou `next` si fourni
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface PostLoginResult {
  redirectTo: string;
}

interface PostLoginOptions {
  next?: string | null;
}

interface SignupMetadata {
  full_name?: string;
  job_title?: string;
  signup_intent?: string;
  commune_choice?: "join" | "create";
  join_commune_id?: string | null;
  create_commune_name?: string | null;
  create_commune_code_postal?: string | null;
}

export async function resolvePostLoginRedirect(
  service: SupabaseClient,
  userId: string,
  userMetadata: Record<string, unknown>,
  options: PostLoginOptions = {},
): Promise<PostLoginResult> {
  const meta = userMetadata as SignupMetadata;

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

  // ─── Intention commune : créer un commune_request pending ───
  // On ne le fait que si :
  //   • signup_intent='commune'
  //   • pas déjà rattaché à une commune
  //   • AUCUNE demande existante pour cet utilisateur (quel que soit
  //     son statut). Le `signup_intent` reste gravé à vie dans
  //     user_metadata : sans ce garde, une demande refusée serait
  //     silencieusement recréée à la connexion suivante, annulant la
  //     décision du super-admin. Après un refus, l'utilisateur
  //     re-soumet manuellement depuis /admin/onboarding.
  if (
    meta.signup_intent === "commune" &&
    !profile?.commune_id &&
    meta.commune_choice
  ) {
    const { data: prior } = await service
      .from("commune_requests")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (!prior || prior.length === 0) {
      const insert: Record<string, unknown> = {
        user_id: userId,
        request_type: meta.commune_choice,
      };
      if (meta.commune_choice === "join" && meta.join_commune_id) {
        insert.commune_id = meta.join_commune_id;
        insert.requested_role = "editor";
      } else if (meta.commune_choice === "create" && meta.create_commune_name) {
        insert.proposed_name = meta.create_commune_name;
        insert.proposed_code_postal = meta.create_commune_code_postal ?? null;
        insert.requested_role = "admin";
      }
      // Best effort — si l'insert échoue (contrainte, autre), on
      // ne bloque pas la connexion. L'utilisateur pourra ré-émettre
      // sa demande depuis /admin/onboarding.
      await service.from("commune_requests").insert(insert);
    }

    return { redirectTo: "/admin/onboarding" };
  }

  // Retour vers la page protégée d'origine si elle est interne
  if (options.next && options.next.startsWith("/")) {
    return { redirectTo: options.next };
  }

  return { redirectTo: "/admin/dashboard" };
}
