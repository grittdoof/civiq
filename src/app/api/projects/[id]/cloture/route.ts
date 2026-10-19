import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { synchroniserAgendasApres } from "@/lib/calendar/after-change";

// ═══════════════════════════════════════════════════════════════
// POST /api/projects/:id/cloture
// Body : { action: "clore", bilan?: string } | { action: "rouvrir" }
//
// Un dossier clôturé sort des projets ouverts, de l'agenda et des
// alertes ; il reste consultable (lecture seule) et peut être rouvert.
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id, { autoriserClos: true });
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; bilan?: unknown };
  const action = body.action === "rouvrir" ? "rouvrir" : body.action === "clore" ? "clore" : null;
  if (!action) return NextResponse.json({ error: "Action inconnue" }, { status: 400 });

  if (action === "clore" && access.closAt) return NextResponse.json({ error: "Ce projet est déjà clôturé." }, { status: 409 });
  if (action === "rouvrir" && !access.closAt) return NextResponse.json({ error: "Ce projet n'est pas clôturé." }, { status: 409 });

  const bilan = typeof body.bilan === "string" ? body.bilan.trim().slice(0, 2000) : "";
  const updates = action === "clore"
    ? { clos_at: new Date().toISOString(), clos_par: access.userId, clos_bilan: bilan || null }
    : { clos_at: null, clos_par: null, clos_bilan: null };

  const service = await createServiceClient();
  const { error } = await service.from("projects").update(updates).eq("id", id).is("deleted_at", null);
  if (error) {
    console.error("[projects] cloture:", error);
    return NextResponse.json({ error: "La modification n'a pas été enregistrée." }, { status: 500 });
  }

  await writeAudit({
    action: action === "clore" ? "project.closed" : "project.reopened",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: action === "clore" ? { bilan: bilan ? true : false } : {},
  });
  synchroniserAgendasApres(access.communeId);
  return NextResponse.json({ ok: true, clos_at: updates.clos_at });
}
