import { redirect } from "next/navigation";
import { headers } from "next/headers";
import AdminShell from "./AdminShell";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// /admin/** — Server-side guard
//
// 1. Auth obligatoire (sinon /auth/login)
// 2. Si pas de commune attribuée :
//      - super-admin : pass-through (peut tout administrer)
//      - sinon → /admin/onboarding (sauf si on y est déjà ou /setup)
// 3. AdminShell injecte la sidebar avec les données pré-fetchées
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") || h.get("x-invoke-path") || "/admin";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select(`role, commune_id, communes(name, slug)`)
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? null;
  const isSuperAdmin = role === "super_admin";
  const commune = (profile?.communes as unknown as { name: string; slug: string } | null) ?? null;

  // Pas de commune et pas super-admin → onboarding
  // Exceptions : /admin/onboarding lui-même, /admin/setup (legacy)
  if (!commune && !isSuperAdmin) {
    const isOnboarding = pathname.startsWith("/admin/onboarding");
    const isSetup = pathname === "/admin/setup";
    if (!isOnboarding && !isSetup) {
      redirect("/admin/onboarding");
    }
  }

  // Modules activés (super-admin = tous, sinon ceux de la commune)
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
