import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAuthContext } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listTickets, getPhotoSignedUrl } from "@/lib/tickets/queries";
import { OUVERT_STATUTS, CLOTURE_STATUTS } from "@/lib/tickets/types";
import { TicketsPDF, type PdfTicket } from "@/lib/tickets/pdf-document";

// ═══════════════════════════════════════════════════════════════
// GET /api/tickets/pdf?filter=ouverts|cloture|tous
//
// Retourne un vrai PDF synthétique de tous les tickets de la commune
// de l'utilisateur courant. Ouvert dans un onglet par le navigateur.
// ═══════════════════════════════════════════════════════════════

// Force Node.js runtime (pas Edge) — @react-pdf/renderer a besoin de Node
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return new NextResponse("Non authentifié", { status: 401 });
  if (!ctx.communeId) return new NextResponse("Aucune commune attribuée", { status: 403 });

  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) return new NextResponse("Module désactivé", { status: 403 });
  }

  const filter = req.nextUrl.searchParams.get("filter") ?? "tous";
  // Multi-select des assignés : ?assignees=id1,id2,id3
  const assigneesParam = req.nextUrl.searchParams.get("assignees");
  const assigneeIds = assigneesParam
    ? assigneesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const filters: Parameters<typeof listTickets>[1] = {};
  if (filter === "ouverts") filters.statut = OUVERT_STATUTS;
  else if (filter === "cloture") filters.statut = CLOTURE_STATUTS;

  let tickets = await listTickets(ctx.communeId, filters);

  // Filtre assignés (assigne_a OU multi-assignés via ticket_assignees)
  if (assigneeIds.length > 0) {
    const serviceFilter = await createServiceClient();
    const { data: multi } = await serviceFilter
      .from("ticket_assignees")
      .select("ticket_id, profile_id")
      .in("profile_id", assigneeIds);
    const ticketsWithAnyAssignee = new Set(
      (multi ?? []).map((r) => r.ticket_id as string),
    );
    const assigneeSet = new Set(assigneeIds);
    tickets = tickets.filter(
      (t) =>
        (t.assigne_a && assigneeSet.has(t.assigne_a)) ||
        ticketsWithAnyAssignee.has(t.id),
    );
  }

  const ticketIds = tickets.map((t) => t.id);

  const service = await createServiceClient();
  const [
    { data: commune },
    { data: commentairesAll },
    { data: assigneesAll },
  ] = await Promise.all([
    service.from("communes").select("name").eq("id", ctx.communeId).single(),
    ticketIds.length
      ? service
          .from("ticket_commentaires")
          .select("id, ticket_id, contenu, is_systeme, created_at")
          .in("ticket_id", ticketIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    ticketIds.length
      ? service
          .from("ticket_assignees")
          .select("ticket_id, profiles:profile_id ( id, full_name )")
          .in("ticket_id", ticketIds)
      : Promise.resolve({ data: [] }),
  ]);

  type AssigneeRow = {
    ticket_id: string;
    profiles: { id: string; full_name: string | null } | null;
  };
  const assigneesByTicket = new Map<string, string[]>();
  for (const row of (assigneesAll ?? []) as unknown as AssigneeRow[]) {
    if (!row.profiles?.full_name) continue;
    const arr = assigneesByTicket.get(row.ticket_id) ?? [];
    arr.push(row.profiles.full_name);
    assigneesByTicket.set(row.ticket_id, arr);
  }

  const commentairesByTicket = new Map<string, PdfTicket["comments"]>();
  for (const c of commentairesAll ?? []) {
    const arr = commentairesByTicket.get(c.ticket_id) ?? [];
    arr.push({
      id: c.id,
      contenu: c.contenu,
      is_systeme: c.is_systeme,
      created_at: c.created_at,
    });
    commentairesByTicket.set(c.ticket_id, arr);
  }

  // URLs signées des photos principales (1ère photo de signalement)
  const photoUrls = new Map<string, string>();
  await Promise.all(
    tickets.flatMap((t) => {
      const first = t.signalement_photos?.[0];
      if (!first) return [];
      return [
        getPhotoSignedUrl(first.storage_path).then((url) => {
          if (url) photoUrls.set(t.id, url);
        }),
      ];
    }),
  );

  const pdfTickets: PdfTicket[] = tickets.map((t) => ({
    id: t.id,
    numero: t.numero,
    titre: t.titre,
    description: t.description,
    canal: t.canal,
    priorite: t.priorite,
    statut: t.statut,
    categorie: t.categorie,
    adresse: t.adresse,
    created_at: t.created_at,
    demandeur_nom: t.demandeur_nom,
    demandeur_telephone: t.demandeur_telephone,
    demandeur_email: t.demandeur_email,
    agentNames:
      assigneesByTicket.get(t.id) ??
      (t.assignee_profile?.full_name ? [t.assignee_profile.full_name] : []),
    photoUrl: photoUrls.get(t.id) ?? null,
    comments: commentairesByTicket.get(t.id) ?? [],
  }));

  const generatedAt = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  let filterLabel =
    filter === "ouverts" ? "tickets ouverts" :
    filter === "cloture" ? "tickets clôturés" :
    "";
  if (assigneeIds.length > 0) {
    const suffix = assigneeIds.length === 1 ? "1 agent" : `${assigneeIds.length} agents`;
    filterLabel = filterLabel ? `${filterLabel} — ${suffix}` : `tickets de ${suffix}`;
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      TicketsPDF({
        communeName: commune?.name ?? "Commune",
        filterLabel,
        generatedAt,
        tickets: pdfTickets,
      }),
    );
  } catch (e) {
    console.error("[pdf] render error:", e);
    return new NextResponse(
      "Erreur de génération du PDF : " + (e instanceof Error ? e.message : "inconnue"),
      { status: 500 },
    );
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = `tickets-${commune?.name?.toLowerCase().replace(/\s+/g, "-") ?? "commune"}-${dateSlug}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
