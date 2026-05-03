import { redirect } from "next/navigation";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { listAssignableAgents } from "@/lib/tickets/mutations";
import NewTicketForm from "./NewTicketForm";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/nouveau — Création d'un ticket
// Wrapper Server qui pré-charge la liste des agents assignables
// puis délègue au formulaire client.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function NewTicketPage() {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) redirect("/admin/dashboard?module=tickets&state=inactive");
  }
  if (!["admin", "editor", "super_admin"].includes(ctx.role || "")) {
    redirect("/admin/tickets?error=forbidden");
  }

  const agents = await listAssignableAgents();
  return <NewTicketForm communeId={ctx.communeId} agents={agents} />;
}
