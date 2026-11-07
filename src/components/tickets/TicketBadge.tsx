import { Inbox, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import IconeCategorie from "./IconeCategorie";
import { URGENCE_COLORS, URGENCE_LABELS, type EtatDelai, type Urgence } from "@/lib/tickets/categories";
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

// ─── Lot 2 : urgence, catégorie de la commune, délai cible ───────

export function UrgenceBadge({ urgence }: { urgence: Urgence }) {
  const c = URGENCE_COLORS[urgence];
  return (
    <span
      className={`tk-badge${urgence === "danger_immediat" ? " tk-badge-pulse" : ""}`}
      style={{ background: c.bg, color: c.fg, fontWeight: urgence === "danger_immediat" ? 700 : undefined }}
      title={`Urgence : ${URGENCE_LABELS[urgence]}`}
    >
      {urgence !== "danger_immediat" && (
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: c.fg, display: "inline-block", marginRight: 5, verticalAlign: "middle" }} />
      )}
      {URGENCE_LABELS[urgence]}
    </span>
  );
}

export function CategorieCheminBadge({ libelle, icone }: { libelle: string; icone: string | null }) {
  return (
    <span className="tk-badge" style={{ background: "var(--border-light)", color: "var(--fg)", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <IconeCategorie nom={icone} size={11} />
      {libelle}
    </span>
  );
}

export function DelaiBadge({ etat }: { etat: EtatDelai | null }) {
  if (!etat || etat === "a_temps") return null;
  const depasse = etat === "depasse";
  return (
    <span className="tk-badge" style={{ background: depasse ? "#FDE7E9" : "#FEF3E2", color: depasse ? "#B0000F" : "#7A4B00" }}>
      {depasse ? "Délai dépassé" : "Délai proche"}
    </span>
  );
}
