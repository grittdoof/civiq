import { notFound, redirect } from "next/navigation";
import { requireCommune } from "@/lib/auth-helpers";
import { getTicket } from "@/lib/tickets/queries";
import { chargerSpectateur } from "@/lib/tickets/droits-server";
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

  const { ticket, rapport, droits } = await getTicket(ctx.communeId, id, await chargerSpectateur());
  if (!ticket || !droits) notFound();

  // Droit « clôturer » de la matrice de la commune (lot 1)
  if (!droits.cloturer) {
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
