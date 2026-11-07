import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { CACHE_REDIRECTION } from "./pieces";

// ═══════════════════════════════════════════════════════════════
// Accès serveur à un signalement pour les routes API (lot 6).
//
// Règle actuelle : module Tickets actif pour l'utilisateur et
// signalement de sa commune (super-admin : toutes les communes).
// Le lot 1 y ajoutera la règle de visibilité (matrice de la
// commune, niveaux restreint / confidentiel) : toutes les routes
// qui servent un contenu de signalement passent par ici.
// Un signalement non visible répond 404, sans détail.
// ═══════════════════════════════════════════════════════════════

export interface TicketAccessible {
  id: string;
  numero: number;
  commune_id: string;
}

export type AccesTicket =
  | { ok: true; ticket: TicketAccessible; userId: string; role: string; service: Awaited<ReturnType<typeof createServiceClient>> }
  | { ok: false; response: NextResponse };

export const introuvable = () => NextResponse.json({ error: "Introuvable" }, { status: 404 });

export async function accesTicketEnLecture(ticketId: string): Promise<AccesTicket> {
  const garde = await requireModule("tickets");
  if (!garde.ok) return garde;

  const service = await createServiceClient();
  const { data: ticket } = await service
    .from("tickets")
    .select("id, numero, commune_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return { ok: false, response: introuvable() };
  if (!garde.isSuperAdmin && ticket.commune_id !== garde.communeId) {
    return { ok: false, response: introuvable() };
  }
  return { ok: true, ticket: ticket as TicketAccessible, userId: garde.userId, role: garde.role, service };
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
