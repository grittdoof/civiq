import { notFound, redirect } from "next/navigation";
import { requireCommune } from "@/lib/auth-helpers";
import { getTicket } from "@/lib/tickets/queries";
import CloseTicketWizard from "./CloseTicketWizard";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/[id]/cloturer — Wizard 3 étapes pour clôturer
// avec rapport d'intervention + photo « service fait ».
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CloseTicketPage({ params }: Props) {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  const { id } = await params;

  const { ticket, rapport } = await getTicket(ctx.communeId, id);
  if (!ticket) notFound();

  // Permissions : super_admin, admin, editor, ou agent assigné
  const canClose =
    ctx.role === "super_admin"
    || ctx.role === "admin"
    || ctx.role === "editor"
    || ticket.assigne_a === ctx.userId;
  if (!canClose) {
    redirect(`/admin/tickets/${id}?error=forbidden`);
  }

  return (
    <CloseTicketWizard
      ticketId={ticket.id}
      ticketNumero={ticket.numero}
      ticketTitre={ticket.titre}
      communeId={ctx.communeId}
      existingRapport={rapport ?? undefined}
    />
  );
}
