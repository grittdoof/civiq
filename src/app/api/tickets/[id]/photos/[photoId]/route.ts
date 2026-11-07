import { NextRequest, NextResponse } from "next/server";
import { accesTicketEnLecture, introuvable, redirectionVersLien } from "@/lib/tickets/acces-server";
import { cheminPhotoValide } from "@/lib/tickets/photos";
import { DUREE_LIEN_SIGNE, cheminMiniature, demandeTelechargement } from "@/lib/tickets/pieces";

// ═══════════════════════════════════════════════════════════════
// GET /api/tickets/:id/photos/:photoId[?taille=miniature][&telecharger=1]
// Adresse stable d'une photo de signalement : droits vérifiés à
// chaque ouverture, puis redirection vers un lien signé de 10 min.
// Miniature absente (photos déposées avant le lot 6) : photo entière.
// ═══════════════════════════════════════════════════════════════

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "tickets-photos";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const acces = await accesTicketEnLecture(id);
  if (!acces.ok) return acces.response;
  const { ticket, service } = acces;

  const { data: photo } = await service
    .from("ticket_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .eq("ticket_id", ticket.id)
    .maybeSingle();
  if (!photo || !cheminPhotoValide(photo.storage_path, ticket.commune_id)) return introuvable();

  const telecharger = demandeTelechargement(req.nextUrl.searchParams);
  const options = telecharger ? { download: `signalement-${ticket.numero}-${photo.id.slice(0, 8)}.jpg` } : undefined;

  if (!telecharger && req.nextUrl.searchParams.get("taille") === "miniature") {
    const mini = cheminMiniature(photo.storage_path);
    if (mini) {
      const { data } = await service.storage.from(BUCKET).createSignedUrl(mini, DUREE_LIEN_SIGNE);
      if (data?.signedUrl) return redirectionVersLien(data.signedUrl);
    }
  }

  const { data, error } = await service.storage.from(BUCKET).createSignedUrl(photo.storage_path, DUREE_LIEN_SIGNE, options);
  if (error || !data?.signedUrl) {
    console.error("[tickets/photos] lien signé:", error);
    return NextResponse.json({ error: "Photo indisponible" }, { status: 404 });
  }
  return redirectionVersLien(data.signedUrl);
}
