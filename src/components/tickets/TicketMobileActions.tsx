"use client";

import Link from "next/link";
import { FileEdit, CheckCircle2 } from "lucide-react";
import { groupOf, type TicketStatut } from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// Barre d'actions mobile pour le détail ticket.
// Cycle de vie simplifié : un ticket est Ouvert → l'utilisateur peut
//   • Clôturer + rédiger le rapport  (CTA principal)
//   • Commenter   (via le champ commentaire dans la timeline, hors barre)
// Si le ticket est déjà clôturé, la barre ne s'affiche pas.
// ═══════════════════════════════════════════════════════════════

interface Props {
  ticketId: string;
  statut: TicketStatut;
  canEdit: boolean;
  hasReport: boolean;
}

export default function TicketMobileActions({
  ticketId, statut, canEdit, hasReport,
}: Props) {
  if (!canEdit) return null;
  if (groupOf(statut) === "cloture") return null;

  return (
    <div className="tk-mobile-actions" aria-label="Actions du ticket">
      <Link
        href={`/admin/tickets/${ticketId}/cloturer`}
        className="civiq-btn civiq-btn-default tk-mobile-actions-primary"
      >
        {hasReport ? <FileEdit size={18} /> : <CheckCircle2 size={18} />}
        <span>{hasReport ? "Modifier le rapport" : "Clôturer et rédiger le rapport"}</span>
      </Link>
    </div>
  );
}
