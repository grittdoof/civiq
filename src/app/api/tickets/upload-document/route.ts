import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { chargerSpectateur, chargerTicketVisible } from "@/lib/tickets/droits-server";
import { peutAgir } from "@/lib/tickets/droits";
import { lireDemandeDepot, preparerDepot, tropLourd, verifierDepot } from "@/lib/storage/depot-direct";
import {
  BUCKET_DOCUMENTS_RAPPORT, MAX_DOCUMENT_RAPPORT_OCTETS,
  cheminDocumentRapport, mimeDocumentRapport, prefixeRapports,
} from "@/lib/tickets/documents-rapport";

// ═══════════════════════════════════════════════════════════════
// POST /api/tickets/upload-document — pièce jointe du rapport de
// clôture, en dépôt direct (lib/storage/depot-direct.ts) :
//   { etape: "preparer", ticket_id, nom, taille } → lien signé
//   { etape: "enregistrer", ticket_id, path }     → chemin vérifié
// Le fichier ne transite pas par Vercel (limite de 4,5 Mo).
// Droits : signalement visible et droit « clôturer » (matrice de la commune).
// `cible: "ticket"` : pièce jointe du ticket lui-même (rappels) — droit
// « modifier », chemin ajouté côté serveur à tickets.document_paths.
// Chemin : tickets/<commune de l'utilisateur>/rapports/, choisi ici.
// ═══════════════════════════════════════════════════════════════

export const runtime = "nodejs";

const FORMAT_REFUSE = () => NextResponse.json(
  { error: "Format non accepté. Formats possibles : PDF, Word, Excel, OpenDocument, texte." },
  { status: 400 },
);

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ctx.role || !["admin", "editor", "super_admin"].includes(ctx.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }
  if (!ctx.communeId) return NextResponse.json({ error: "Aucune commune rattachée" }, { status: 403 });

  const body = await lireDemandeDepot(req);
  if (!body) return NextResponse.json({ error: "Requête de dépôt invalide." }, { status: 400 });

  const ticketId = typeof body.ticket_id === "string" ? body.ticket_id : "";
  if (!ticketId) return NextResponse.json({ error: "Signalement requis" }, { status: 400 });

  const service = await createServiceClient();
  // Lot 1 : signalement visible ET droit « clôturer » de la matrice.
  const spectateur = await chargerSpectateur();
  const ticket = await chargerTicketVisible(service, ticketId, spectateur);
  if (!ticket || !spectateur || ticket.commune_id !== ctx.communeId) {
    return NextResponse.json({ error: "Signalement introuvable" }, { status: 404 });
  }
  const surTicket = body.cible === "ticket";
  if (surTicket ? !peutAgir("modifier", ticket.droits, spectateur) : !peutAgir("cloturer", ticket.droits, spectateur)) {
    return NextResponse.json({ error: surTicket ? "Vous ne pouvez pas modifier ce ticket" : "Vous ne pouvez pas clôturer ce signalement" }, { status: 403 });
  }

  const prefixe = prefixeRapports(ctx.communeId);

  if (body.etape === "preparer") {
    const nom = (typeof body.nom === "string" ? body.nom : "").trim().slice(0, 200);
    if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    const contentType = mimeDocumentRapport(nom);
    const path = cheminDocumentRapport(ctx.communeId, nom, crypto.randomUUID());
    if (!contentType || !path) return FORMAT_REFUSE();
    if (Number(body.taille) > MAX_DOCUMENT_RAPPORT_OCTETS) return tropLourd(MAX_DOCUMENT_RAPPORT_OCTETS);
    return preparerDepot(service, BUCKET_DOCUMENTS_RAPPORT, path, contentType);
  }

  const depot = await verifierDepot(service, BUCKET_DOCUMENTS_RAPPORT, body.path, prefixe, MAX_DOCUMENT_RAPPORT_OCTETS);
  if (!depot.ok) return depot.response;
  if (!mimeDocumentRapport(depot.path)) {
    await service.storage.from(BUCKET_DOCUMENTS_RAPPORT).remove([depot.path]);
    return FORMAT_REFUSE();
  }
  if (surTicket) {
    const { data: t } = await service.from("tickets").select("document_paths").eq("id", ticketId).maybeSingle();
    const chemins = [...new Set([...((t?.document_paths as string[] | null) ?? []), depot.path])].slice(0, 30);
    const { error } = await service.from("tickets").update({ document_paths: chemins }).eq("id", ticketId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ path: depot.path });
}
