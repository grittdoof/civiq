import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { notifyTicketReopened } from "@/lib/tickets/push";

/**
 * Cron — réouverture des tickets dont la date de suivi est atteinte.
 *
 * Déclenché par Vercel Cron toutes les heures (cf. vercel.json).
 *
 * Sécurité : Vercel injecte automatiquement un header
 *   Authorization: Bearer <CRON_SECRET>
 * sur les crons configurés. On le vérifie avant tout traitement.
 *
 * Algorithme :
 *  1. Appelle RPC `reopen_due_tickets()` qui UPDATE en lot
 *     les tickets dont `reopen_at <= now()`.
 *  2. Pour chaque ticket rouvert, récupère les agents assignés
 *     (table ticket_assignees + assigne_a legacy) et envoie
 *     push + email + SMS via notifyTicketReopened.
 *  3. Le commentaire système est inséré par le trigger SQL.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // 1. Auth — Vercel injecte le Bearer token automatiquement
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // En dev local, on autorise sans secret pour faciliter les tests.
    // En prod, CRON_SECRET doit OBLIGATOIREMENT être défini.
    if (process.env.NODE_ENV === "production") {
      console.error("[cron/reopen-tickets] CRON_SECRET non configuré en prod");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
  }

  // 2. Réouverture en lot via RPC
  const service = await createServiceClient();
  const { data: reopened, error } = await service.rpc("reopen_due_tickets");
  if (error) {
    console.error("[cron/reopen-tickets] RPC error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tickets = (reopened ?? []) as Array<{
    id: string;
    numero: number;
    titre: string;
    assigne_a: string | null;
    reopen_reason: string | null;
  }>;

  if (tickets.length === 0) {
    return NextResponse.json({ reopened: 0 });
  }

  // 3. Récupère les agents assignés (legacy assigne_a + table multi-assignees)
  const ticketIds = tickets.map((t) => t.id);
  const { data: multiAssignees } = await service
    .from("ticket_assignees")
    .select("ticket_id, profile_id")
    .in("ticket_id", ticketIds);

  const assigneesByTicket = new Map<string, Set<string>>();
  tickets.forEach((t) => {
    const set = new Set<string>();
    if (t.assigne_a) set.add(t.assigne_a);
    assigneesByTicket.set(t.id, set);
  });
  multiAssignees?.forEach((a) => {
    assigneesByTicket.get(a.ticket_id)?.add(a.profile_id);
  });

  // 4. Base URL pour les liens dans push/email
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    "https://www.gociviq.fr";

  // 5. Envoi des notifications (parallèle)
  const results = await Promise.allSettled(
    tickets.map((t) =>
      notifyTicketReopened({
        ticketId: t.id,
        ticketNumero: t.numero,
        titre: t.titre,
        assigneeIds: Array.from(assigneesByTicket.get(t.id) ?? []),
        reason: t.reopen_reason,
        baseUrl,
      }),
    ),
  );

  const notifSent = results.filter((r) => r.status === "fulfilled").length;
  const notifFailed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    reopened: tickets.length,
    notif_sent: notifSent,
    notif_failed: notifFailed,
    tickets: tickets.map((t) => ({ id: t.id, numero: t.numero })),
  });
}
