import { redirect } from "next/navigation";
import { headers } from "next/headers";
import AdminShell from "./AdminShell";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// /admin/** — Server-side guard
//
// IMPORTANT : ce layout NE redirige PAS vers /admin/onboarding pour
// éviter les boucles. Les pages individuelles (dashboard, surveys…)
// le font elles-mêmes via requireCommune().
//
// 1. Auth obligatoire (sinon /auth/login)
// 2. Bypass sidebar pour /admin/onboarding et /admin/setup
// 3. Sinon : AdminShell avec données pré-fetchées
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") || "/admin";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
  }

  const isOnboarding = pathname.startsWith("/admin/onboarding");
  const isSetup = pathname === "/admin/setup";

  // Bypass shell pour onboarding / setup (sidebar inutile)
  if (isOnboarding || isSetup) {
    return <>{children}</>;
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select(`role, commune_id, communes(name, slug)`)
    .eq("id", user.id)
    .maybeSingle();

  // Filet de sécurité : auto-créer le profil si manquant
  if (!profile) {
    await service.from("profiles").upsert({
      id: user.id,
      role: "viewer",
      job_title: "citoyen",
    });
  }

  const role = profile?.role ?? "viewer";
  const isSuperAdmin = role === "super_admin";
  const commune = (profile?.communes as unknown as { name: string; slug: string } | null) ?? null;

  // Modules activés (effectifs pour CE user, après application des règles role + overrides)
  let modules: string[] = [];
  if (isSuperAdmin) {
    const { data: all } = await service.from("modules").select("id").eq("is_available", true);
    modules = (all ?? []).map((m) => m.id);
  } else if (role === "viewer") {
    // Lecteurs : aucun module
    modules = [];
  } else if (profile?.commune_id) {
    // editor/admin : commune_modules MINUS overrides désactivés pour ce user
    const [{ data: cm }, { data: overrides }] = await Promise.all([
      service.from("commune_modules").select("module_id").eq("commune_id", profile.commune_id),
      service.from("profile_module_overrides").select("module_id, enabled").eq("profile_id", user.id),
    ]);
    const disabled = new Set((overrides ?? []).filter((o) => o.enabled === false).map((o) => o.module_id));
    modules = (cm ?? []).map((c) => c.module_id).filter((id) => !disabled.has(id));
  }

  return (
    <AdminShell
      commune={commune}
      isSuperAdmin={isSuperAdmin}
      role={role}
      initialActiveModuleKeys={modules}
    >
      {children}
    </AdminShell>
  );
}
