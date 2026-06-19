import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import type { FinancingStatus, FinancingEligibility } from "@/lib/projects/types";

// PATCH/DELETE une ligne de financement.
// Sur changement de statut → audit + notification push aux abonnés.

interface RouteParams { params: Promise<{ id: string; fid: string }>; }

interface PatchBody {
  financeur?: string;
  dispositif?: string | null;
  montant_demande?: number | null;
  montant_obtenu?: number | null;
  statut?: FinancingStatus;
  date_demande?: string | null;
  date_ar?: string | null;
  date_decision?: string | null;
  // Suivi détaillé éligibilité
  definition_commencement?: string | null;
  date_notification_marche?: string | null;
  date_ordre_service?: string | null;
  eligibilite?: FinancingEligibility;
  eligibilite_note?: string | null;
  taux?: number | null;
  plafond?: number | null;
  deadline_depot?: string | null;
  notes?: string | null;
}

const ALLOWED = new Set<keyof PatchBody>([
  "financeur", "dispositif", "montant_demande", "montant_obtenu", "statut",
  "date_demande", "date_ar", "date_decision", "notes",
  "definition_commencement", "date_notification_marche", "date_ordre_service",
  "eligibilite", "eligibilite_note", "taux", "plafond", "deadline_depot",
]);

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, fid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: PatchBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  for (const k of Object.keys(body) as (keyof PatchBody)[]) {
    if (!ALLOWED.has(k)) continue;
    const v = body[k];
    if (typeof v === "string") updates[k] = v.trim() || null;
    else updates[k] = v;
  }

  const service = await createServiceClient();
  const { data: previous } = await service
    .from("financings")
    .select("statut")
    .eq("id", fid)
    .eq("project_id", id)
    .maybeSingle();

  const { data, error } = await service
    .from("financings")
    .update(updates)
    .eq("id", fid)
    .eq("project_id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Financement introuvable" }, { status: 404 });

  // Notif sur changement de statut (accordee / refusee notamment)
  if (
    typeof body.statut === "string" &&
    previous?.statut !== body.statut &&
    (body.statut === "accordee" || body.statut === "refusee")
  ) {
    await writeAudit({
      action: `project.financing.${body.statut}`,
      targetType: "project",
      targetId: id,
      communeId: access.communeId,
      metadata: { financing_id: fid, financeur: data.financeur },
    });
    import("@/lib/projects/push")
      .then(({ notifyFinancingStatusChange }) =>
        notifyFinancingStatusChange({
          projectId: id,
          financingId: fid,
          financeur: data.financeur,
          newStatus: data.statut,
        }),
      )
      .catch((e) => console.error("[push] financing:", e));
  }

  return NextResponse.json({ financing: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, fid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  const service = await createServiceClient();
  const { error } = await service
    .from("financings")
    .delete()
    .eq("id", fid)
    .eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    action: "project.financing.deleted",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { financing_id: fid },
  });
  return NextResponse.json({ ok: true });
}
