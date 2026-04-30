import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import OnboardingForm from "./OnboardingForm";

// ═══════════════════════════════════════════════════════════════
// /admin/onboarding — Server Component
//
// Pré-charge côté serveur :
//  • la commune existante de l'utilisateur (pour redirect si déjà
//    rattaché)
//  • la liste des communes publiques (pour le formulaire « join »)
//  • la demande pending éventuelle de l'utilisateur
//
// Le rendu HTML est garanti même si le JS client est cassé.
// La logique interactive est dans OnboardingForm.tsx (Client).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PendingRequest {
  id: string;
  request_type: "join" | "create";
  status: "pending" | "rejected";
  proposed_name: string | null;
  rejection_reason: string | null;
  created_at: string;
  communes?: { name: string; slug: string } | null;
}

interface CommuneOption {
  id: string;
  name: string;
  slug: string;
  code_postal: string | null;
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/admin/onboarding");

  const service = await createServiceClient();

  // Si déjà rattaché → dashboard
  const { data: profile } = await service
    .from("profiles")
    .select("commune_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.commune_id || profile?.role === "super_admin") {
    redirect("/admin/dashboard");
  }

  // Demande en cours / rejetée la plus récente
  const { data: requests } = await service
    .from("commune_requests")
    .select("id, request_type, status, proposed_name, rejection_reason, created_at, communes(name, slug)")
    .eq("user_id", user.id)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false })
    .limit(5);
  const pending = (requests?.[0] ?? null) as PendingRequest | null;

  // Liste des communes (pour le tab « join »)
  const { data: communesRaw } = await service
    .from("communes")
    .select("id, name, slug, code_postal, archived_at")
    .order("name");
  const communes: CommuneOption[] = (communesRaw ?? [])
    .filter((c) => !(c as { archived_at?: string }).archived_at)
    .map(({ id, name, slug, code_postal }) => ({ id, name, slug, code_postal }));

  return (
    <OnboardingForm
      initialPending={pending}
      initialCommunes={communes}
      userEmail={user.email ?? null}
    />
  );
}
