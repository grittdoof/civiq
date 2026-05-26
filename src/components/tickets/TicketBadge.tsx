import { Inbox, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  PRIORITE_LABELS, PRIORITE_COLORS,
  CATEGORIE_LABELS, CATEGORIE_ICONS,
  GROUP_LABELS, GROUP_COLORS, groupOf,
  type TicketPriorite, type TicketStatut, type TicketCategorie,
  type TicketGroup,
} from "@/lib/tickets/types";

const GROUP_ICONS: Record<TicketGroup, LucideIcon> = {
  ouvert: Inbox,
  cloture: CheckCircle2,
};

// ═══════════════════════════════════════════════════════════════
// Badges pour les attributs d'un ticket — couleurs strictes
// selon le cahier des charges (basse=gris, normale=bleu,
// haute=orange, urgente=rouge avec pulse subtil).
// ═══════════════════════════════════════════════════════════════

export function PrioriteBadge({ priorite, withDot = true }: { priorite: TicketPriorite; withDot?: boolean }) {
  const c = PRIORITE_COLORS[priorite];
  const isUrgent = priorite === "urgente";
  return (
    <span
      className={`tk-badge${isUrgent ? " tk-badge-pulse" : ""}`}
      style={{ background: c.bg, color: c.fg }}
      title={`Priorité ${PRIORITE_LABELS[priorite]}`}
    >
      {withDot && (
        <span
          aria-hidden
          style={{
            width: 6, height: 6, borderRadius: "50%", background: c.fg,
            display: "inline-block", marginRight: 5, verticalAlign: "middle",
          }}
        />
      )}
      {PRIORITE_LABELS[priorite]}
    </span>
  );
}

export function StatutBadge({ statut }: { statut: TicketStatut }) {
  const group = groupOf(statut);
  const c = GROUP_COLORS[group];
  const Icon = GROUP_ICONS[group];
  return (
    <span className="tk-badge" style={{ background: c.bg, color: c.fg }}>
      <Icon size={11} strokeWidth={2.5} aria-hidden style={{ marginRight: 4 }} />
      {GROUP_LABELS[group]}
    </span>
  );
}

export function CategorieBadge({ categorie }: { categorie: TicketCategorie }) {
  return (
    <span className="tk-badge" style={{ background: "var(--border-light)", color: "var(--fg-muted)" }}>
      <span aria-hidden style={{ marginRight: 4 }}>{CATEGORIE_ICONS[categorie]}</span>
      {CATEGORIE_LABELS[categorie]}
    </span>
  );
}
