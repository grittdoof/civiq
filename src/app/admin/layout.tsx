import { redirect } from "next/navigation";
import { headers } from "next/headers";
import AdminShell from "./AdminShell";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// /admin/** — Server-side guard
//
// Cette layout SERVER vérifie l'authentification AVANT d'envoyer le
// HTML. Si non connecté → redirect 307 vers /auth/login.
// L'UI client (sidebar) est dans AdminShell.tsx.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") || h.get("x-invoke-path") || "/admin";

  // /admin/setup est l'onboarding post-magic-link : on vérifie juste
  // l'auth, pas la commune (qui est en cours de création)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const target = encodeURIComponent(pathname);
    redirect(`/auth/login?redirect=${target}`);
  }

  // Lire le profil + modules actifs côté serveur (pas de flash UI)
  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select(`role, commune_id, communes(name, slug)`)
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? null;
  const isSuperAdmin = role === "super_admin";
  const commune = (profile?.communes as unknown as { name: string; slug: string } | null) ?? null;

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
      initialActiveModuleKeys={modules}
    >
      {children}
    </AdminShell>
  );
}
