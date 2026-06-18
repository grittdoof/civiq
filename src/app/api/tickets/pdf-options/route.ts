import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// GET /api/tickets/pdf-options
//
// Retourne :
//   • compteurs par statut (ouverts / clôture / tous)
//   • liste des utilisateurs ayant des tickets (assigné principal
//     OU dans ticket_assignees) avec le nombre de tickets de chacun
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ctx.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) return NextResponse.json({ error: "Module désactivé" }, { status: 403 });
  }

  const service = await createServiceClient();

  // 1. Récupère tous les tickets de la commune
  const { data: tickets } = await service
    .from("tickets")
    .select("id, statut, assigne_a")
    .eq("commune_id", ctx.communeId);

  const allTickets = tickets ?? [];
  const OUVERT = ["nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente"];
  const CLOTURE = ["resolu", "clos"];

  const counts = {
    tous: allTickets.length,
    ouverts: allTickets.filter((t) => OUVERT.includes(t.statut)).length,
    cloture: allTickets.filter((t) => CLOTURE.includes(t.statut)).length,
  };

  // 2. Multi-assignés
  const ticketIds = allTickets.map((t) => t.id);
  let multi: { ticket_id: string; profile_id: string }[] = [];
  if (ticketIds.length > 0) {
    const { data } = await service
      .from("ticket_assignees")
      .select("ticket_id, profile_id")
      .in("ticket_id", ticketIds);
    multi = (data ?? []) as { ticket_id: string; profile_id: string }[];
  }

  // 3. Compteur de tickets par utilisateur (assignés ou créateur ?
  //    → on se limite à 'assignés' : sens du « tickets rattachés »)
  const ticketsByUser = new Map<string, Set<string>>();
  for (const t of allTickets) {
    if (t.assigne_a) {
      const s = ticketsByUser.get(t.assigne_a) ?? new Set();
      s.add(t.id);
      ticketsByUser.set(t.assigne_a, s);
    }
  }
  for (const m of multi) {
    const s = ticketsByUser.get(m.profile_id) ?? new Set();
    s.add(m.ticket_id);
    ticketsByUser.set(m.profile_id, s);
  }

  const userIds = [...ticketsByUser.keys()];
  let users: Array<{ id: string; full_name: string | null; count: number }> = [];
  if (userIds.length > 0) {
    const { data: profiles } = await service
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    users = (profiles ?? [])
      .map((p) => ({
        id: p.id as string,
        full_name: (p.full_name as string | null) ?? null,
        count: ticketsByUser.get(p.id as string)?.size ?? 0,
      }))
      .sort((a, b) => (b.count - a.count) || (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }

  return NextResponse.json({ counts, users });
}
