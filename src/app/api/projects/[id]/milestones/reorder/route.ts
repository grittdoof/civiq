import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { ordresPour } from "@/lib/projects/etapes";

// ═══════════════════════════════════════════════════════════════
// POST /api/projects/:id/milestones/reorder — { ids: string[] }
// Nouvel ordre complet des étapes (glisser-déposer). Seules les étapes
// du projet sont touchées ; un identifiant étranger est ignoré.
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 500) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Ordre vide" }, { status: 400 });

  const service = await createServiceClient();
  const { data: rows } = await service.from("milestones").select("id").eq("project_id", id).is("deleted_at", null);
  const duProjet = new Set((rows ?? []).map((r) => r.id as string));
  const ordres = ordresPour(ids.filter((x) => duProjet.has(x)));

  const erreurs = (await Promise.all(
    [...ordres].map(([mid, ordre]) => service.from("milestones").update({ ordre }).eq("id", mid).eq("project_id", id)),
  )).filter((r) => r.error);
  if (erreurs.length) {
    console.error("[milestones] reorder:", erreurs[0].error);
    return NextResponse.json({ error: "Le nouvel ordre n'a pas été enregistré." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ordres: Object.fromEntries(ordres) });
}
