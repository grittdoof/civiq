import { NextRequest, NextResponse } from "next/server";
import { accesTicketEnLecture, introuvable, redirectionVersLien } from "@/lib/tickets/acces-server";
import { BUCKET_DOCUMENTS_RAPPORT, estCheminRapportValide, nomAffichable } from "@/lib/tickets/documents-rapport";
import { DUREE_LIEN_SIGNE, demandeTelechargement, ouvrirDansNavigateur, trouverDocument } from "@/lib/tickets/pieces";

// ═══════════════════════════════════════════════════════════════
// GET /api/tickets/:id/documents/:nom[?telecharger=1]
// Adresse stable d'un document du rapport de clôture. Le nom doit
// figurer sur le rapport du signalement et sous le dossier de sa
// commune. PDF : affiché dans l'onglet ; Word, Excel… : téléchargés
// sous leur nom lisible.
// ═══════════════════════════════════════════════════════════════

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Next.js fournit le segment déjà décodé ou non selon les versions. */
function decoder(segment: string): string {
  try { return decodeURIComponent(segment); } catch { return segment; }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; nom: string }> }) {
  const { id, nom } = await params;
  const acces = await accesTicketEnLecture(id);
  if (!acces.ok) return acces.response;
  const { ticket, service } = acces;

  const { data: rapport } = await service
    .from("ticket_rapports")
    .select("document_paths")
    .eq("ticket_id", ticket.id)
    .maybeSingle();
  const chemin = trouverDocument(
    rapport?.document_paths as string[] | null,
    decoder(nom),
    (c) => estCheminRapportValide(c, ticket.commune_id),
  );
  if (!chemin) return introuvable();

  const lisible = nomAffichable(chemin);
  const telecharger = demandeTelechargement(req.nextUrl.searchParams) || !ouvrirDansNavigateur(lisible);
  const { data, error } = await service.storage
    .from(BUCKET_DOCUMENTS_RAPPORT)
    .createSignedUrl(chemin, DUREE_LIEN_SIGNE, telecharger ? { download: lisible } : undefined);
  if (error || !data?.signedUrl) {
    console.error("[tickets/documents] lien signé:", error);
    return NextResponse.json({ error: "Document indisponible" }, { status: 404 });
  }
  return redirectionVersLien(data.signedUrl);
}
