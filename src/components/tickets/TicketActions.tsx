"use client";

import Link from "next/link";
import { CheckCircle2, FileEdit, Lock } from "lucide-react";
import {
  GROUP_LABELS,
  GROUP_COLORS,
  STATUT_LABELS,
  groupOf,
  type TicketStatut,
  type TicketPriorite,
} from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// TicketActions — sidebar du détail ticket sur desktop.
//
// Cycle de vie simplifié : un ticket est Ouvert → seules 2 actions
// utilisateur existent :
//   • Clôturer + rédiger le rapport  (CTA principal, ce composant)
//   • Commenter le journal d'activité (champ inline dans la timeline,
//     hors de ce composant)
//
// Quand le ticket est clôturé, plus aucune action — juste un état
// informatif.
// ═══════════════════════════════════════════════════════════════

interface Props {
  ticketId: string;
  ticketNumero: number;
  statut: TicketStatut;
  // Conservés pour rétrocompat des appels existants — pas utilisés.
  priorite?: TicketPriorite;
  assigneId?: string | null;
  assigneeName?: string | null;
  assigneeIds?: string[];
  assigneeProfiles?: Array<{ id: string; full_name: string | null }>;
  canEdit: boolean;
  canAssign?: boolean;
  isSuperAdmin?: boolean;
  agents?: Array<{ id: string; full_name: string | null; job_title: string | null }>;
  hasReport: boolean;
}

export default function TicketActions({
  ticketId, statut, canEdit, hasReport,
}: Props) {
  const group = groupOf(statut);
  const isClosed = group === "cloture";
  const c = GROUP_COLORS[group];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* CTA principal : ouvert → Clôturer + rapport ; clôturé → état */}
      {!isClosed && canEdit && (
        <Link
          href={`/admin/tickets/${ticketId}/cloturer`}
          className="civiq-btn civiq-btn-default"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {hasReport ? <FileEdit size={16} /> : <CheckCircle2 size={16} />}
          {hasReport ? "Modifier le rapport" : "Clôturer et rédiger le rapport"}
        </Link>
      )}

      {/* État informatif quand clôturé */}
      {isClosed && (
        <div
          className="civiq-card"
          style={{
            padding: 14,
            display: "flex", alignItems: "center", gap: 10,
            background: c.bg,
            borderColor: c.fg,
          }}
        >
          <Lock size={16} style={{ color: c.fg, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: c.fg }}>
              {GROUP_LABELS[group]}
            </div>
            <div style={{ fontSize: 13, color: "var(--fg)", marginTop: 2 }}>
              {STATUT_LABELS[statut]}
            </div>
          </div>
        </div>
      )}

      {/* Aide pour le commentaire */}
      {!isClosed && canEdit && (
        <p
          style={{
            fontSize: 12, color: "var(--fg-muted)",
            lineHeight: 1.5, padding: "0 4px",
            margin: 0,
          }}
        >
          Tu peux aussi ajouter un commentaire dans le journal d&apos;activité
          plus bas, sans clôturer.
        </p>
      )}
    </div>
  );
}
