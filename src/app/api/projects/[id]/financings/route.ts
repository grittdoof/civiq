import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { parseFinancing } from "@/lib/projects/money-validation";
import { findOrCreateContact } from "@/lib/projects/contacts";

// ═══════════════════════════════════════════════════════════════
// GET  /api/projects/:id/financings   — liste les subventions
// POST /api/projects/:id/financings   — ajoute une ligne
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("financings")
    .select("*")
    .is("deleted_at", null)
    .eq("project_id", id)
    .order("created_at");
  return NextResponse.json({ financings: data ?? [] });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const parsed = parseFinancing(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const service = await createServiceClient();
  const fields = { ...parsed.value };
  if (fields.financeur_local_id) {
    const { data: fl } = await service
      .from("financeurs_locaux").select("id, contact_id").eq("id", fields.financeur_local_id)
      .eq("commune_id", access.communeId).is("deleted_at", null).maybeSingle();
    if (!fl) return NextResponse.json({ error: "Financeur local introuvable" }, { status: 404 });
    fields.source = "local";
    if (fl.contact_id && !fields.contact_id) fields.contact_id = fl.contact_id as string;
  } else if (fields.aide_ref) {
    fields.source = "api";
  }
  if (fields.contact_id) {
    const { data: c } = await service
      .from("contacts").select("id").eq("id", fields.contact_id).eq("commune_id", access.communeId).is("deleted_at", null).maybeSingle();
    if (!c) return NextResponse.json({ error: "Financeur introuvable dans l'annuaire" }, { status: 404 });
  } else if (fields.financeur) {
    const c = await findOrCreateContact(service, {
      communeId: access.communeId, nom: fields.financeur, type: "financeur", categorie: "financeur", source: "saisie", createdBy: access.userId,
    });
    if (c) fields.contact_id = c.id;
  }

  const { data, error } = await service
    .from("financings")
    .insert({ project_id: id, statut: "a_demander", ...fields })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });

  await writeAudit({
    action: "project.financing.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { financing_id: data.id, financeur: data.financeur, statut: data.statut },
  });

  return NextResponse.json({ financing: data });
}
