import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

// ═══════════════════════════════════════════════════════════════
// POST /api/projects/from-ticket
// Body : { ticket_id }
//
// Transforme un ticket en projet (étape émergence) en
// pré-remplissant titre + description + source_ticket_id.
// Notifie le créateur du ticket + les pilotes désignés
// (si fournis), le ticket reste vivant et obtient projet_id.
// ═══════════════════════════════════════════════════════════════

interface Body {
  ticket_id?: string;
  pilote_elu?: string | null;
  pilote_agent?: string | null;
}

export async function POST(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  let body: Body = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!body.ticket_id) return NextResponse.json({ error: "ticket_id requis" }, { status: 400 });

  const service = await createServiceClient();
  const { data: ticket } = await service
    .from("tickets")
    .select("id, numero, titre, description, created_by, project_id")
    .eq("id", body.ticket_id)
    .eq("commune_id", guard.communeId)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
  if (ticket.project_id) {
    return NextResponse.json(
      { error: "Ce ticket est déjà rattaché à un projet", project_id: ticket.project_id },
      { status: 409 },
    );
  }

  // Crée le projet
  const { data: created, error } = await service
    .from("projects")
    .insert({
      commune_id: guard.communeId,
      titre: ticket.titre,
      description: ticket.description,
      source_ticket_id: ticket.id,
      pilote_elu: body.pilote_elu || null,
      pilote_agent: body.pilote_agent || null,
      created_by: guard.userId,
    })
    .select("id")
    .single();
  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Création échouée" }, { status: 500 });
  }

  // Lie le ticket
  await service.from("tickets").update({ project_id: created.id }).eq("id", ticket.id);

  await writeAudit({
    action: "project.created_from_ticket",
    targetType: "project",
    targetId: created.id,
    communeId: guard.communeId,
    metadata: { ticket_id: ticket.id, ticket_numero: ticket.numero },
  });

  // Notification push
  const pilotes = [body.pilote_elu, body.pilote_agent].filter(Boolean) as string[];
  import("@/lib/projects/push")
    .then(({ notifyTicketTransformedToProject }) =>
      notifyTicketTransformedToProject({
        projectId: created.id,
        ticketId: ticket.id,
        ticketNumero: ticket.numero,
        pilotes,
        ticketCreator: ticket.created_by,
      }),
    )
    .catch((e) => console.error("[push] from-ticket:", e));

  return NextResponse.json({ project_id: created.id });
}
