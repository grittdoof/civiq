import { redirect } from "next/navigation";
import SuperAdminShell from "./SuperAdminShell";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// /super-admin/** — Server-side guard
//
// Vérifie l'authentification ET le rôle super_admin avant tout
// rendu HTML. Redirige sinon vers /auth/login ou /admin/dashboard.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/super-admin/dashboard");

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    redirect("/admin/dashboard?error=forbidden");
  }

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
