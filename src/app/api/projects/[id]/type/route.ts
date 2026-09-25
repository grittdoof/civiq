import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { decideTypeChange } from "@/lib/projects/type-change";
import { PROJECT_PHASES_BY_TYPE, type ProjectType, type TypeProjetCode } from "@/lib/projects/types";
import type { JalonModele } from "@/lib/projects/wizard";

// ═══════════════════════════════════════════════════════════════
// POST /api/projects/:id/type
// Corps : { type_code, confirmer?: boolean, ajouter_jalons?: boolean }
//
// Règles (lib/projects/type-change) appliquées côté serveur :
//   409 { alerte }         → changement refusé (données financières)
//   409 { avertissement }  → confirmation requise (renvoyer confirmer: true)
//   200 { ok: true }       → type changé ; phase legacy ramenée au 1er
//                            jalon du gabarit ; jalons types ajoutés à la
//                            demande (« Ce projet prend de l'ampleur »).
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }>; }

const LEGACY: Record<TypeProjetCode, ProjectType> = {
  investissement: "investment",
  evenementiel: "event",
  suivi_simple: "tracking",
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: { type_code?: TypeProjetCode; confirmer?: boolean; ajouter_jalons?: boolean } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const to = body.type_code;
  if (!to || !(to in LEGACY)) return NextResponse.json({ error: "Type de projet inconnu" }, { status: 400 });

  const service = await createServiceClient();
  const { data: project } = await service
    .from("projects")
    .select("type_code")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  const from = project.type_code as TypeProjetCode;
  if (from === to) return NextResponse.json({ ok: true });

  const count = async (table: string) => {
    const { count: n } = await service
      .from(table).select("id", { count: "exact", head: true }).eq("project_id", id).is("deleted_at", null);
    return n ?? 0;
  };
  const [lignes_budget, devis, subventions] = await Promise.all([
    count("project_budget_lines"), count("project_quotes"), count("financings"),
  ]);

  const decision = decideTypeChange(from, to, { lignes_budget, devis, subventions });
  if (!decision.ok) return NextResponse.json({ alerte: decision.alerte }, { status: 409 });
  if (decision.avertissement && !body.confirmer) {
    return NextResponse.json({ avertissement: decision.avertissement }, { status: 409 });
  }

  const { error } = await service
    .from("projects")
    .update({ type_code: to, phase: PROJECT_PHASES_BY_TYPE[LEGACY[to]][0] })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let added = 0;
  if (body.ajouter_jalons) {
    const { data: tp } = await service.from("types_projet").select("jalons_modele").eq("code", to).maybeSingle();
    const modeles = ((tp?.jalons_modele ?? []) as JalonModele[]).filter((m) => !m.conditionnel);
    if (modeles.length) {
      const { data: last } = await service
        .from("milestones").select("ordre").eq("project_id", id).is("deleted_at", null)
        .order("ordre", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      const start = ((last?.ordre as number | null) ?? 0) + 10;
      const { error: jErr } = await service.from("milestones").insert(
        modeles.map((m, i) => ({
          project_id: id,
          libelle: m.libelle,
          statut: "a_faire",
          ordre: start + i * 10,
          created_by: access.userId,
        })),
      );
      if (!jErr) added = modeles.length;
    }
  }

  await writeAudit({
    action: "project.type_changed",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { from, to, jalons_ajoutes: added },
  });

  return NextResponse.json({ ok: true, jalons_ajoutes: added });
}
