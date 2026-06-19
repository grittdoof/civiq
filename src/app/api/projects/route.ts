import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { listProjects } from "@/lib/projects/queries";
import type { ProjectCompetence, ProjectPhase } from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// GET  /api/projects             — liste des projets de la commune
// POST /api/projects              — crée un projet en émergence
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;

  if (!guard.communeId) {
    return NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 });
  }

  const phase = req.nextUrl.searchParams.get("phase");
  const search = req.nextUrl.searchParams.get("search") ?? "";

  const projects = await listProjects(guard.communeId, {
    phase: phase ? (phase as ProjectPhase) : undefined,
    search,
  });

  return NextResponse.json({ projects });
}

interface CreateBody {
  titre?: string;
  description?: string | null;
  objectifs?: string | null;
  competence?: ProjectCompetence;
  budget_estime?: number;
  sans_subvention?: boolean;
  pilote_elu?: string | null;
  pilote_agent?: string | null;
  taux_inflation?: number | null;
  taux_actualisation?: number | null;
  source_ticket_id?: string | null;
  concerne_tiers?: boolean;
  tiers_nom?: string | null;
  tiers_type?: string | null;
  tiers_contact?: string | null;
  accompagne_sans_financer?: boolean;
}

export async function POST(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;

  if (!guard.communeId) {
    return NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 });
  }
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  let body: CreateBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const titre = body.titre?.trim();
  if (!titre) {
    return NextResponse.json({ error: "Le titre est obligatoire" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from("projects")
    .insert({
      commune_id: guard.communeId,
      titre,
      description: body.description?.trim() || null,
      objectifs: body.objectifs?.trim() || null,
      competence: body.competence ?? "a_verifier",
      budget_estime: Number(body.budget_estime ?? 0),
      sans_subvention: !!body.sans_subvention,
      pilote_elu: body.pilote_elu || null,
      pilote_agent: body.pilote_agent || null,
      taux_inflation: body.taux_inflation ?? null,
      taux_actualisation: body.taux_actualisation ?? null,
      source_ticket_id: body.source_ticket_id || null,
      concerne_tiers: !!body.concerne_tiers,
      tiers_nom: body.concerne_tiers ? body.tiers_nom?.trim() || null : null,
      tiers_type: body.concerne_tiers ? body.tiers_type || null : null,
      tiers_contact: body.concerne_tiers ? body.tiers_contact?.trim() || null : null,
      accompagne_sans_financer: !!body.accompagne_sans_financer,
      created_by: guard.userId,
    })
    .select("id, titre, phase")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Création échouée" },
      { status: 500 },
    );
  }

  await writeAudit({
    action: "project.created",
    targetType: "project",
    targetId: data.id,
    communeId: guard.communeId,
    metadata: { titre: data.titre, source_ticket_id: body.source_ticket_id ?? null },
  });

  return NextResponse.json({ project: data });
}
