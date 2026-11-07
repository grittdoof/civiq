import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";
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
// Droits : admin, éditeur ou super-admin de la commune du signalement.
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
  const { data: ticket } = await service
    .from("tickets").select("id, commune_id").eq("id", ticketId).maybeSingle();
  if (!ticket || ticket.commune_id !== ctx.communeId) {
    return NextResponse.json({ error: "Signalement introuvable" }, { status: 404 });
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
  return NextResponse.json({ path: depot.path });
}
