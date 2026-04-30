import { createClient, createServiceClient } from "@/lib/supabase-server";

export interface AuthContext {
  userId: string;
  email: string | null;
  role: "super_admin" | "admin" | "editor" | "viewer" | null;
  communeId: string | null;
}

// Récupère l'auth context (bypass RLS pour fiabilité)
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role, commune_id")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? null,
    role: (profile?.role as AuthContext["role"]) ?? null,
    communeId: profile?.commune_id ?? null,
  };
}

export function isSuperAdmin(ctx: AuthContext | null): boolean {
  return ctx?.role === "super_admin";
}

export function isCommuneAdmin(ctx: AuthContext | null): boolean {
  return ctx?.role === "admin" || ctx?.role === "super_admin";
}

// Server Component helper : redirige selon le statut de l'utilisateur
//   - non connecté → /auth/login
//   - super-admin → pass-through
//   - rattaché à une commune → pass-through
//   - sans commune → /admin/onboarding
export async function requireCommune(): Promise<AuthContext> {
  const { redirect } = await import("next/navigation");
  const ctx = await getAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (ctx!.role === "super_admin") return ctx!;
  if (!ctx!.communeId) {
    redirect("/admin/onboarding");
  }
  return ctx!;
}
