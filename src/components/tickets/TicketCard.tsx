import Link from "next/link";
import { MapPin, User, Clock } from "lucide-react";
import type { TicketWithRelations } from "@/lib/tickets/types";
import { PrioriteBadge, StatutBadge, CategorieBadge } from "./TicketBadge";

// ═══════════════════════════════════════════════════════════════
// Card affichée dans la liste /admin/tickets
// Mobile-first : photo à gauche, contenu à droite, badges en haut.
// ═══════════════════════════════════════════════════════════════

export default function TicketCard({
  ticket,
  signedPhotoUrl,
}: {
  ticket: TicketWithRelations;
  signedPhotoUrl?: string | null;
}) {
  const elapsed = formatElapsed(ticket.created_at);
  const assigneeName = ticket.assignee_profile?.full_name || null;

  return (
    <Link href={`/admin/tickets/${ticket.id}`} className="tk-card civiq-card civiq-card-hover">
      {signedPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signedPhotoUrl} alt="" className="tk-card-thumb" />
      ) : (
        <div className="tk-card-thumb tk-card-thumb-empty" aria-hidden>
          <span style={{ fontSize: 28, opacity: 0.4 }}>📋</span>
        </div>
      )}

      <div className="tk-card-body">
        <div className="tk-card-badges">
          <PrioriteBadge priorite={ticket.priorite} />
          <CategorieBadge categorie={ticket.categorie} />
          <StatutBadge statut={ticket.statut} />
        </div>

        <h3 className="tk-card-title">
          <span className="tk-card-numero">#{ticket.numero}</span>
          {ticket.titre}
        </h3>

        {ticket.description && (
          <p className="tk-card-desc">
            {ticket.description.length > 130 ? ticket.description.slice(0, 130) + "…" : ticket.description}
          </p>
        )}

        <div className="tk-card-meta">
          {ticket.adresse && (
            <span className="tk-card-meta-item" title={ticket.adresse}>
              <MapPin size={12} /> {ticket.adresse.length > 40 ? ticket.adresse.slice(0, 40) + "…" : ticket.adresse}
            </span>
          )}
          {assigneeName && (
            <span className="tk-card-meta-item">
              <User size={12} /> {assigneeName}
            </span>
          )}
          <span className="tk-card-meta-item">
            <Clock size={12} /> {elapsed}
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatElapsed(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return minutes <= 1 ? "à l'instant" : `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `il y a ${weeks} sem.`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
