// ═══════════════════════════════════════════════════════════════
// MODULE GUARD — Vérifie qu'un module est activé pour la commune
//
// Utilisable côté serveur dans les Route Handlers et Server
// Components pour bloquer l'accès aux features d'un module non
// activé.
//
// Exemple dans une API route :
//   const guard = await requireModule("surveys");
//   if (!guard.ok) return guard.response;
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

type GuardResult =
  | { ok: true; communeId: string; userId: string; role: string; isSuperAdmin: boolean }
  | { ok: false; response: NextResponse };

export async function requireModule(moduleKey: string): Promise<GuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, role, commune_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { ok: false, response: NextResponse.json({ error: "Profil introuvable" }, { status: 403 }) };
  }

  // Le super-admin a toujours accès à tout
  if (profile.role === "super_admin") {
    return {
      ok: true,
      userId: user.id,
      role: profile.role,
      communeId: profile.commune_id ?? "",
      isSuperAdmin: true,
    };
  }

  if (!profile.commune_id) {
    return { ok: false, response: NextResponse.json({ error: "Aucune commune associée" }, { status: 403 }) };
  }

  // Viewer : aucun module
  if (profile.role === "viewer") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Les lecteurs n'ont pas accès aux modules" },
        { status: 403 }
      ),
    };
  }

  const { data: cm } = await service
    .from("commune_modules")
    .select("module_id")
    .eq("commune_id", profile.commune_id)
    .eq("module_id", moduleKey)
    .maybeSingle();

  if (!cm) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Module « ${moduleKey} » non activé pour votre commune` },
        { status: 403 }
      ),
    };
  }

  // Override par utilisateur : si une ligne existe avec enabled=false → bloqué
  const { data: override } = await service
    .from("profile_module_overrides")
    .select("enabled")
    .eq("profile_id", user.id)
    .eq("module_id", moduleKey)
    .maybeSingle();
  if (override?.enabled === false) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Module « ${moduleKey} » désactivé pour votre compte` },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    userId: user.id,
    role: profile.role,
    communeId: profile.commune_id,
    isSuperAdmin: false,
  };
}

/** Version côté Server Component (redirect au lieu de NextResponse) */
export async function isModuleActive(moduleKey: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role, commune_id")
    .eq("id", user.id)
    .single();

  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role === "viewer") return false;       // lecteurs : aucun module
  if (!profile.commune_id) return false;

  const { data: cm } = await service
    .from("commune_modules")
    .select("module_id")
    .eq("commune_id", profile.commune_id)
    .eq("module_id", moduleKey)
    .maybeSingle();
  if (!cm) return false;

  // Override par utilisateur (super-admin a pu désactiver ce module pour ce user)
  const { data: override } = await service
    .from("profile_module_overrides")
    .select("enabled")
    .eq("profile_id", user.id)
    .eq("module_id", moduleKey)
    .maybeSingle();
  if (override?.enabled === false) return false;

  return true;
}
