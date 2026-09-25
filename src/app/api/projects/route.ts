import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { listProjects } from "@/lib/projects/queries";
import type { ProjectPhase } from "@/lib/projects/types";
import { validateWizard, type WizardInput } from "@/lib/projects/wizard";

// ═══════════════════════════════════════════════════════════════
// GET  /api/projects             — liste des projets de la commune
// POST /api/projects             — crée un projet depuis l'assistant
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

// POST : payload de l'assistant de création (lib/projects/wizard). La
// création (projet + étapes modèles + commissions + contributeurs +
// partenaires + lien ticket) est transactionnelle côté base
// (create_project_from_wizard, migration 040), qui revérifie que chaque
// référence appartient à la commune.
export async function POST(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) {
    return NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 });
  }
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  let body: WizardInput;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const result = validateWizard(body);
  if (!result.ok) {
    return NextResponse.json({ error: "Certaines informations manquent", fields: result.errors }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: id, error } = await service.rpc("create_project_from_wizard", {
    p: { ...result.payload, commune_id: guard.communeId, created_by: guard.userId },
  });
  if (error || !id) {
    console.error("[projects] create_project_from_wizard:", error);
    return NextResponse.json({ error: "La création a échoué. Vos saisies sont conservées : réessayez." }, { status: 500 });
  }

  await writeAudit({
    action: "project.created",
    targetType: "project",
    targetId: id as string,
    communeId: guard.communeId,
    metadata: { type_code: result.payload.type_code, jalons: result.payload.jalons.length },
  });

  return NextResponse.json({ id });
}
