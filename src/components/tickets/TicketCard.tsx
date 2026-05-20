import Link from "next/link";
import { Camera, MapPin, Clock } from "lucide-react";
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
// Card de la liste /admin/tickets — responsive :
//   • Mobile (< md) : photo héros en haut, badges overlay, texte en
//     dessous (direction Airbnb).
//   • Desktop (≥ md) : photo en miniature à gauche (180px), contenu
//     dense à droite — meilleur pour scanner beaucoup de tickets sur
//     écran large.
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
      className="block w-full overflow-hidden bg-white text-left no-underline transition-shadow hover:shadow-md md:flex md:items-stretch"
      style={{
        border: `1px solid ${TK.line}`,
        borderRadius: 18,
        boxShadow: "0 1px 2px rgba(10,14,26,0.04)",
      }}
    >
      {/* ─── PHOTO ───
          mobile : pleine largeur en haut, 200 px de haut
          desktop : carré 180×180 à gauche                          */}
      <div
        className="relative md:shrink-0"
        style={{
          // Width handled per breakpoint via responsive class on parent
        }}
      >
        <div
          className="relative w-full overflow-hidden md:h-full"
          style={{
            background: "#E5E7EB",
          }}
        >
          {/* Mobile : photo 200px de haut, coins arrondis seulement en haut */}
          <div
            className="relative w-full md:hidden"
            style={{
              height: 200,
              borderTopLeftRadius: 17,
              borderTopRightRadius: 17,
              overflow: "hidden",
            }}
          >
            {signedPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedPhotoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <TKPhoto categorie={ticket.categorie} size="lg" />
            )}
          </div>

          {/* Desktop : photo carrée 180×180, coins arrondis à gauche */}
          <div
            className="relative hidden md:block"
            style={{
              width: 180,
              height: 180,
              borderTopLeftRadius: 17,
              borderBottomLeftRadius: 17,
              overflow: "hidden",
            }}
          >
            {signedPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedPhotoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  background: "#E5E7EB",
                  fontSize: 42,
                  color: TK.muted,
                }}
              >
                📋
              </div>
            )}
          </div>
        </div>

        {/* Badges en overlay (mobile uniquement — sur desktop ils sont
            dans la colonne droite pour rester lisibles) */}
        <div className="absolute left-3 top-3 md:hidden">
          <TKPriorityBadge priorite={ticket.priorite} />
        </div>
        <div className="absolute right-3 top-3 md:hidden">
          <TKStatusBadge statut={ticket.statut} />
        </div>
        {photoCount > 0 && (
          <div
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white md:hidden"
            style={{ background: "rgba(10,14,26,0.62)" }}
          >
            <Camera size={11} strokeWidth={2} />
            {photoCount}
          </div>
        )}
      </div>

      {/* ─── CONTENU ─── */}
      <div className="flex flex-1 flex-col px-4 py-3.5 md:px-5 md:py-4">
        {/* Desktop : badges + numéro en haut */}
        <div className="mb-2 hidden flex-wrap items-center gap-2 md:flex">
          <TKPriorityBadge priorite={ticket.priorite} />
          <TKStatusBadge statut={ticket.statut} />
          <TKCategoryChip categorie={ticket.categorie} size="sm" />
          <span
            className="ml-auto text-[12px] font-semibold"
            style={{ color: TK.muted }}
          >
            #{ticket.numero}
          </span>
        </div>

        {/* Titre + numéro (mobile : numéro à droite ; desktop : numéro déjà au-dessus) */}
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3
            className="m-0 flex-1 text-base font-bold leading-tight tracking-tight md:text-lg"
            style={{ color: TK.ink, letterSpacing: "-0.015em" }}
          >
            {ticket.titre}
          </h3>
          <span
            className="whitespace-nowrap text-[11px] font-semibold md:hidden"
            style={{ color: TK.muted }}
          >
            #{ticket.numero}
          </span>
        </div>

        {/* Description (desktop seulement, pour densité de lecture) */}
        {ticket.description && (
          <p
            className="mb-2 hidden text-[13px] leading-snug md:line-clamp-2 md:block"
            style={{ color: TK.ink2 }}
          >
            {ticket.description}
          </p>
        )}

        {/* Adresse */}
        {ticket.adresse && (
          <div
            className="mb-2.5 flex items-start gap-1.5 text-[13px] leading-snug"
            style={{ color: TK.muted }}
          >
            <MapPin
              size={13}
              className="mt-0.5 hidden shrink-0 md:inline"
            />
            <span>
              {ticket.adresse.length > 80
                ? ticket.adresse.slice(0, 80) + "…"
                : ticket.adresse}
            </span>
          </div>
        )}

        {/* Footer : chip catégorie + date · assignés (mobile et desktop
            partagent ce footer, à quelques détails près) */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {/* La chip catégorie est déjà dans les badges desktop. */}
            <span className="md:hidden">
              <TKCategoryChip categorie={ticket.categorie} size="sm" />
            </span>
            <span
              className="inline-flex items-center gap-1 text-[11px] md:gap-1.5 md:text-[12px]"
              style={{ color: TK.muted }}
            >
              <Clock
                size={11}
                className="hidden shrink-0 md:inline"
              />
              <span className="md:hidden">·&nbsp;</span>
              {elapsed}
              {photoCount > 0 && (
                <span className="hidden items-center gap-1 md:inline-flex">
                  <span>·</span>
                  <Camera size={11} className="shrink-0" />
                  {photoCount}
                </span>
              )}
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
