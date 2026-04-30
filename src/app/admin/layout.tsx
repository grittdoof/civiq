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

  // Modules activés
  let modules: string[] = [];
  if (isSuperAdmin) {
    const { data: all } = await service.from("modules").select("id").eq("is_available", true);
    modules = (all ?? []).map((m) => m.id);
  } else if (profile?.commune_id) {
    const { data: cm } = await service
      .from("commune_modules")
      .select("module_id")
      .eq("commune_id", profile.commune_id);
    modules = (cm ?? []).map((c) => c.module_id);
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
