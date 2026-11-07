import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { CACHE_REDIRECTION } from "./pieces";
import { chargerSpectateur, chargerTicketVisible } from "./droits-server";
import type { Spectateur, TicketPourDroits } from "./droits";

// ═══════════════════════════════════════════════════════════════
// Accès serveur à un signalement pour les routes API (lot 6).
//
// Module Tickets actif pour l'utilisateur ET signalement visible
// selon la règle du lot 1 (matrice de la commune, niveaux restreint /
// confidentiel, destinataires). Toutes les routes qui servent un
// contenu de signalement passent par ici.
// Un signalement non visible répond 404, sans détail.
// ═══════════════════════════════════════════════════════════════

export interface TicketAccessible {
  id: string;
  numero: number;
  commune_id: string;
}

export type AccesTicket =
  | {
      ok: true; ticket: TicketAccessible; userId: string; role: string;
      service: Awaited<ReturnType<typeof createServiceClient>>;
      spectateur: Spectateur; droits: TicketPourDroits;
    }
  | { ok: false; response: NextResponse };

export const introuvable = () => NextResponse.json({ error: "Introuvable" }, { status: 404 });

export async function accesTicketEnLecture(ticketId: string): Promise<AccesTicket> {
  const garde = await requireModule("tickets");
  if (!garde.ok) return garde;

  const service = await createServiceClient();
  const spectateur = await chargerSpectateur();
  const visible = await chargerTicketVisible(service, ticketId, spectateur);
  if (!visible || !spectateur) return { ok: false, response: introuvable() };
  const ticket: TicketAccessible = { id: visible.id, numero: visible.numero, commune_id: visible.commune_id };
  return { ok: true, ticket, userId: garde.userId, role: garde.role, service, spectateur, droits: visible.droits };
}

/**
 * Redirection vers un lien signé. Le navigateur peut la réutiliser
 * quelques minutes (réponse privée, jamais mise en cache partagé) :
 * les images ne sont pas retéléchargées à chaque affichage.
 */
export function redirectionVersLien(url: string): NextResponse {
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", `private, max-age=${CACHE_REDIRECTION}`);
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
