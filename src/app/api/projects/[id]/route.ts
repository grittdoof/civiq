import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { getProject } from "@/lib/projects/queries";
import type { ProjectCompetence } from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// GET    /api/projects/:id   — fiche projet complète
// PATCH  /api/projects/:id   — mise à jour des champs scalaires
//                              (pas la phase — utiliser /advance)
// DELETE /api/projects/:id   — suppression (admin only)
// ═══════════════════════════════════════════════════════════════

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) {
    return NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 });
  }
  const { id } = await params;
  const detail = await getProject(guard.communeId, id);
  if (!detail.project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

interface PatchBody {
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
  cout_reel?: number | null;
  explication_ecart?: string | null;
  concerne_tiers?: boolean;
  tiers_nom?: string | null;
  tiers_type?: string | null;
  tiers_contact?: string | null;
  accompagne_sans_financer?: boolean;
  in_ppi?: boolean;
}

const PATCH_ALLOWED = new Set<keyof PatchBody>([
  "titre",
  "description",
  "objectifs",
  "competence",
  "budget_estime",
  "sans_subvention",
  "pilote_elu",
  "pilote_agent",
  "taux_inflation",
  "taux_actualisation",
  "cout_reel",
  "explication_ecart",
  "concerne_tiers",
  "tiers_nom",
  "tiers_type",
  "tiers_contact",
  "accompagne_sans_financer",
  "in_ppi",
]);

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) {
    return NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 });
  }
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const { id } = await params;
  let body: PatchBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(body) as (keyof PatchBody)[]) {
    if (!PATCH_ALLOWED.has(key)) continue;
    const v = body[key];
    if (typeof v === "string") updates[key] = v.trim() || null;
    else updates[key] = v;
  }
  if (typeof body.titre === "string") {
    const t = body.titre.trim();
    if (!t) return NextResponse.json({ error: "Le titre ne peut pas être vide" }, { status: 400 });
    updates.titre = t;
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from("projects")
    .update(updates)
    .eq("id", id)
    .eq("commune_id", guard.communeId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  await writeAudit({
    action: "project.updated",
    targetType: "project",
    targetId: id,
    communeId: guard.communeId,
    metadata: { fields: Object.keys(updates) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) {
    return NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 });
  }
  // Règle métier : suppression projet réservée au super-admin
  // (données structurantes : historique financier, délibérations,
  // contraintes d'archivage RGPD / comptable).
  if (guard.role !== "super_admin") {
    return NextResponse.json(
      { error: "Seul un super-administrateur peut supprimer un projet. Contactez le support." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const service = await createServiceClient();
  const { error } = await service
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("commune_id", guard.communeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    action: "project.deleted",
    targetType: "project",
    targetId: id,
    communeId: guard.communeId,
  });

  return NextResponse.json({ ok: true });
}
