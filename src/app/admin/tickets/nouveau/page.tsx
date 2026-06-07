import { redirect } from "next/navigation";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { listAssignableAgents } from "@/lib/tickets/mutations";
import { createServiceClient } from "@/lib/supabase-server";
import ForbiddenScreen from "@/components/ForbiddenScreen";
import NewTicketForm from "./NewTicketForm";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/nouveau — Création d'un ticket
// Wrapper Server qui pré-charge la liste des agents assignables
// puis délègue au formulaire client.
//
// Si l'utilisateur n'a pas les droits, on affiche un écran explicatif
// avec contact de l'administrateur plutôt qu'un redirect silencieux.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

async function loadCommuneContact(communeId: string | null) {
  if (!communeId) return { name: null, email: null };
  const service = await createServiceClient();
  const { data } = await service
    .from("communes")
    .select("name, contact_email")
    .eq("id", communeId)
    .maybeSingle();
  return { name: data?.name ?? null, email: data?.contact_email ?? null };
}

export default async function NewTicketPage() {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");

  // Module désactivé : on garde le redirect car c'est une question de
  // configuration commune-niveau, pas de droits utilisateur.
  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) redirect("/admin/dashboard?module=tickets&state=inactive");
  }

  // Droits utilisateur : on AFFICHE un écran explicatif (plus de redirect).
  if (!["admin", "editor", "super_admin"].includes(ctx.role || "")) {
    const commune = await loadCommuneContact(ctx.communeId);
    return (
      <ForbiddenScreen
        title="Création de ticket non autorisée"
        action="créer un ticket d'intervention"
        communeName={commune.name}
        contactEmail={commune.email}
        backHref="/admin/tickets"
        backLabel="Retour à la liste"
      />
    );
  }

  const agents = await listAssignableAgents();
  return <NewTicketForm communeId={ctx.communeId} agents={agents} />;
}
