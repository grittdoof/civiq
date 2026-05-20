import Link from "next/link";
import { Camera } from "lucide-react";
import type { TicketWithRelations } from "@/lib/tickets/types";
import {
  TKStatusBadge,
  TKPriorityBadge,
  TKCategoryChip,
  TKAvatarStack,
  TKPhoto,
} from "@/components/tickets/ui/tk-primitives";
import { TK } from "@/lib/tickets/design-tokens";

// ═══════════════════════════════════════════════════════════════
// Card de la liste /admin/tickets — direction Airbnb :
// photo héros 16:9 large, badges priorité + statut en overlay,
// titre + numéro, adresse, chip catégorie + avatars assignés.
// ═══════════════════════════════════════════════════════════════

export default function TicketCard({
  ticket,
  signedPhotoUrl,
}: {
  ticket: TicketWithRelations;
  signedPhotoUrl?: string | null;
}) {
  const elapsed = formatElapsed(ticket.created_at);
  const photoCount = ticket.signalement_photos?.length ?? 0;

  // Liste d'assignés (multi-assignés à venir → assignee_profile principal + …)
  // Pour l'instant on prend le primary uniquement
  const assignees = ticket.assignee_profile
    ? [
        {
          id: ticket.assignee_profile.id,
          name: ticket.assignee_profile.full_name,
        },
      ]
    : [];

  return (
    <Link
      href={`/admin/tickets/${ticket.id}`}
      className="block w-full overflow-hidden bg-white text-left no-underline transition-shadow"
      style={{
        border: `1px solid ${TK.line}`,
        borderRadius: 18,
        boxShadow: "0 1px 2px rgba(10,14,26,0.04)",
      }}
    >
      {/* PHOTO HÉROS — coins arrondis seulement en haut (collés au cadre) */}
      <div className="relative">
        {signedPhotoUrl ? (
          <div
            className="relative w-full overflow-hidden"
            style={{
              height: 200,
              background: "#E5E7EB",
              borderTopLeftRadius: 17,
              borderTopRightRadius: 17,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedPhotoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div
            className="overflow-hidden"
            style={{
              borderTopLeftRadius: 17,
              borderTopRightRadius: 17,
            }}
          >
            <TKPhoto categorie={ticket.categorie} size="lg" />
          </div>
        )}

        <div className="absolute left-3 top-3">
          <TKPriorityBadge priorite={ticket.priorite} />
        </div>
        <div className="absolute right-3 top-3">
          <TKStatusBadge statut={ticket.statut} />
        </div>
        {photoCount > 0 && (
          <div
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
            style={{ background: "rgba(10,14,26,0.62)" }}
          >
            <Camera size={11} strokeWidth={2} />
            {photoCount}
          </div>
        )}
      </div>

      {/* TEXTE — dans le cadre, séparé visuellement de la photo */}
      <div className="px-4 py-3.5">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3
            className="m-0 flex-1 text-base font-bold leading-tight tracking-tight"
            style={{ color: TK.ink, letterSpacing: "-0.015em" }}
          >
            {ticket.titre}
          </h3>
          <span
            className="whitespace-nowrap text-[11px] font-semibold"
            style={{ color: TK.muted }}
          >
            #{ticket.numero}
          </span>
        </div>
        {ticket.adresse && (
          <div
            className="mb-2.5 text-[13px] leading-snug"
            style={{ color: TK.muted }}
          >
            {ticket.adresse.length > 60
              ? ticket.adresse.slice(0, 60) + "…"
              : ticket.adresse}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <TKCategoryChip categorie={ticket.categorie} size="sm" />
            <span className="text-[11px]" style={{ color: TK.muted }}>
              · {elapsed}
            </span>
          </div>
          {assignees.length > 0 ? (
            <TKAvatarStack agents={assignees} size={24} />
          ) : (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: TK.rouge + "12", color: TK.rouge }}
            >
              Non assigné
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function formatElapsed(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60)
    return minutes <= 1 ? "à l'instant" : `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `il y a ${weeks} sem.`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}
