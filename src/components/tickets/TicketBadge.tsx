import {
  Sparkles, UserCheck, PlayCircle, Activity, Pause,
  CheckCircle2, Lock, Ban,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  PRIORITE_LABELS, PRIORITE_COLORS,
  STATUT_LABELS, STATUT_COLORS,
  CATEGORIE_LABELS, CATEGORIE_ICONS,
  type TicketPriorite, type TicketStatut, type TicketCategorie,
} from "@/lib/tickets/types";

const STATUT_ICONS: Record<TicketStatut, LucideIcon> = {
  nouveau: Sparkles,
  assigne: UserCheck,
  pris_en_charge: PlayCircle,
  en_cours: Activity,
  en_attente: Pause,
  resolu: CheckCircle2,
  clos: Lock,
  annule: Ban,
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
  const c = STATUT_COLORS[statut];
  const Icon = STATUT_ICONS[statut];
  return (
    <span className="tk-badge" style={{ background: c.bg, color: c.fg }}>
      <Icon size={11} strokeWidth={2.5} aria-hidden style={{ marginRight: 4 }} />
      {STATUT_LABELS[statut]}
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
