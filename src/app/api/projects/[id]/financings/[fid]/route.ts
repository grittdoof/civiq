import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { parseFinancing } from "@/lib/projects/money-validation";
import { softDeleteFields } from "@/lib/projects/soft-delete";

// PATCH/DELETE une ligne de financement.
// Sur changement de statut → audit + notification push aux abonnés.

interface RouteParams { params: Promise<{ id: string; fid: string }>; }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, fid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const parsed = parseFinancing(body, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updates: Record<string, unknown> = { ...parsed.value };
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Aucune modification" }, { status: 400 });

  const service = await createServiceClient();
  const { data: previous } = await service
    .from("financings")
    .select("statut")
    .is("deleted_at", null)
    .eq("id", fid)
    .eq("project_id", id)
    .maybeSingle();

  if (typeof updates.contact_id === "string") {
    const { data: c } = await service
      .from("contacts").select("id").eq("id", updates.contact_id).eq("commune_id", access.communeId).is("deleted_at", null).maybeSingle();
    if (!c) return NextResponse.json({ error: "Financeur introuvable dans l'annuaire" }, { status: 404 });
  }

  const { data, error } = await service
    .from("financings")
    .update(updates)
    .eq("id", fid)
    .eq("project_id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Financement introuvable" }, { status: 404 });

  // Notif sur changement de statut (accordee / refusee notamment)
  if (
    typeof parsed.value.statut === "string" &&
    previous?.statut !== parsed.value.statut &&
    (parsed.value.statut === "accordee" || parsed.value.statut === "refusee")
  ) {
    await writeAudit({
      action: `project.financing.${parsed.value.statut}`,
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
    .update(softDeleteFields(access.userId))
    .eq("id", fid)
    .eq("project_id", id)
    .is("deleted_at", null);
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
