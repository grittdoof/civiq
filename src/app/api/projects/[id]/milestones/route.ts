import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { PROJECT_PHASES_BY_TYPE, type ProjectPhase } from "@/lib/projects/types";
import { parseEtapeFields } from "@/lib/projects/etapes";
import { ALERTE_COMMENCEMENT, ALERTE_COMMENCEMENT_SAVOIR, isErreurCommencement } from "@/lib/projects/financement";

// GET  /api/projects/:id/milestones
// POST /api/projects/:id/milestones

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("milestones")
    .select("*")
    .is("deleted_at", null)
    .eq("project_id", id)
    .order("ordre", { nullsFirst: false })
    .order("date_previsionnelle", { nullsFirst: false });
  return NextResponse.json({ milestones: data ?? [] });
}

// Corps : { libelle, statut?, date_previsionnelle?, date_reelle?, est_un_jalon?,
//          remonter_au_reporting?, commentaire?, commentaire_note_interne?,
//          phase? (legacy, facultative), echeance? (legacy) }
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!("libelle" in body)) return NextResponse.json({ error: "Le libellé est obligatoire." }, { status: 400 });

  const parsed = parseEtapeFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const service = await createServiceClient();
  if (parsed.fields.responsable_user_id) {
    const { data: prof } = await service
      .from("profiles").select("id").eq("id", parsed.fields.responsable_user_id).eq("commune_id", access.communeId).maybeSingle();
    if (!prof) return NextResponse.json({ error: "Responsable introuvable" }, { status: 404 });
  }

  // Nouvelle étape en fin de liste.
  let ordre = parsed.fields.ordre;
  if (ordre === undefined) {
    const { data: last } = await service
      .from("milestones").select("ordre").eq("project_id", id).is("deleted_at", null)
      .order("ordre", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    ordre = ((last?.ordre as number | null) ?? 0) + 10;
  }

  // Phase legacy (ancienne interface par phases) : toutes les phases des 3 gabarits.
  const allPhases = Object.values(PROJECT_PHASES_BY_TYPE).flat() as ProjectPhase[];
  const phase = typeof body.phase === "string" && allPhases.includes(body.phase as ProjectPhase) ? body.phase : null;
  const echeance = typeof body.echeance === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.echeance) ? body.echeance : null;

  const { data, error } = await service
    .from("milestones")
    .insert({
      project_id: id,
      phase,
      ...(echeance && !parsed.fields.date_previsionnelle ? { echeance } : {}),
      ...parsed.fields,
      ordre,
      created_by: access.userId,
    })
    .select("*")
    .single();

  if (isErreurCommencement(error?.message)) {
    return NextResponse.json({ alerte: ALERTE_COMMENCEMENT, enSavoirPlus: ALERTE_COMMENCEMENT_SAVOIR }, { status: 409 });
  }
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  await writeAudit({
    action: "project.milestone.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { milestone_id: data.id },
  });
  return NextResponse.json({ milestone: data });
}
