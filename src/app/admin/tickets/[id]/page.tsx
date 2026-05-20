import { notFound, redirect } from "next/navigation";
import { requireCommune } from "@/lib/auth-helpers";
import {
  getTicket,
  getPhotoSignedUrl,
} from "@/lib/tickets/queries";
import { listAssignableAgents } from "@/lib/tickets/mutations";
import { isModuleActive } from "@/lib/module-guard";
import TicketsRealtime from "@/components/tickets/TicketsRealtime";
import TicketDetailMobile from "./TicketDetailMobile";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/[id] — Détail (phase 4 : refonte Airbnb mobile).
// Server Component qui fetch + transmet à TicketDetailMobile (client).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: Props) {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) redirect("/admin/dashboard?module=tickets&state=inactive");
  }

  const { id } = await params;
  const [{ ticket, photos, commentaires, rapport, assignees }, agents] =
    await Promise.all([getTicket(ctx.communeId, id), listAssignableAgents()]);
  if (!ticket) notFound();

  // Permissions
  const isSuperAdmin = ctx.role === "super_admin";
  const isAdmin = ctx.role === "admin";
  const isEditor = ctx.role === "editor";
  const isAssignee =
    ticket.assigne_a === ctx.userId ||
    assignees.some((a) => a.id === ctx.userId);
  const isCreator = ticket.created_by === ctx.userId;
  const canEdit =
    isSuperAdmin || isAdmin || isEditor || isAssignee || isCreator;
  const canAssign = isSuperAdmin || isAdmin || isEditor;
  const canComment = canEdit;

  // URLs signées pour les photos
  const photoUrls = await Promise.all(
    photos.map(async (p) => ({
      ...p,
      url: await getPhotoSignedUrl(p.storage_path),
    })),
  );
  const signalementPhotos = photoUrls.filter((p) => p.type === "signalement");
  const serviceFaitPhotos = photoUrls.filter((p) => p.type === "service_fait");

  return (
    <>
      <TicketDetailMobile
        ticket={{
          id: ticket.id,
          numero: ticket.numero,
          titre: ticket.titre,
          description: ticket.description,
          statut: ticket.statut,
          priorite: ticket.priorite,
          categorie: ticket.categorie,
          canal: ticket.canal,
          adresse: ticket.adresse,
          latitude: ticket.latitude,
          longitude: ticket.longitude,
          precision_geo: ticket.precision_geo,
          created_at: ticket.created_at,
          created_by: ticket.created_by,
          created_by_name: ticket.created_by_profile?.full_name ?? null,
          assigne_a: ticket.assigne_a,
        }}
        signalementPhotos={signalementPhotos}
        serviceFaitPhotos={serviceFaitPhotos}
        commentaires={commentaires}
        rapport={rapport}
        assignees={assignees}
        agents={agents}
        perms={{ canEdit, canAssign, canComment }}
      />
      <TicketsRealtime communeId={ctx.communeId!} ticketId={ticket.id} />
    </>
  );
}
