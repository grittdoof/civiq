import { notFound, redirect } from "next/navigation";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { getTicket } from "@/lib/tickets/queries";
import { listAssignableAgents } from "@/lib/tickets/mutations";
import EditTicketForm from "./EditTicketForm";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/[id]/modifier — Édition d'un ticket existant.
// Server Component qui pré-charge le ticket + agents.
// Chaque modification est automatiquement journalisée.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTicketPage({ params }: Props) {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) redirect("/admin/dashboard?module=tickets&state=inactive");
  }

  const { id } = await params;
  const { ticket, assignees } = await getTicket(ctx.communeId, id);
  if (!ticket) notFound();

  // Permissions : éditeur/admin/super-admin OR assigné OR créateur
  const isSuperAdmin = ctx.role === "super_admin";
  const isAdmin = ctx.role === "admin";
  const isEditor = ctx.role === "editor";
  const isAssignee =
    ticket.assigne_a === ctx.userId || assignees.some((a) => a.id === ctx.userId);
  const isCreator = ticket.created_by === ctx.userId;
  const canEdit = isSuperAdmin || isAdmin || isEditor || isAssignee || isCreator;
  if (!canEdit) {
    redirect(`/admin/tickets/${id}?error=forbidden`);
  }

  const agents = await listAssignableAgents();

  return (
    <EditTicketForm
      communeId={ctx.communeId}
      agents={agents}
      ticket={{
        id: ticket.id,
        numero: ticket.numero,
        canal: ticket.canal,
        titre: ticket.titre,
        description: ticket.description,
        categorie: ticket.categorie,
        priorite: ticket.priorite,
        adresse: ticket.adresse,
        latitude: ticket.latitude,
        longitude: ticket.longitude,
        precision_geo: ticket.precision_geo,
        demandeur_nom: ticket.demandeur_nom,
        demandeur_telephone: ticket.demandeur_telephone,
        demandeur_email: ticket.demandeur_email,
        demandeur_adresse: ticket.demandeur_adresse,
        echeance: ticket.echeance,
      }}
      initialAssigneeIds={assignees.map((a) => a.id)}
    />
  );
}
