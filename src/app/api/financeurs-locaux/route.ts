import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { findOrCreateContact } from "@/lib/projects/contacts";
import { parseFinanceurLocal } from "@/lib/aides/financeurs-locaux";

// GET  /api/financeurs-locaux — fiches de la commune
// POST /api/financeurs-locaux — nouvelle fiche (administrateur de la commune)

export async function GET() {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const service = await createServiceClient();
  const { data } = await service.from("financeurs_locaux").select("*")
    .eq("commune_id", guard.communeId).is("deleted_at", null).order("nom");
  return NextResponse.json({ financeurs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Réservé aux administrateurs de la commune" }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const parsed = parseFinanceurLocal(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const service = await createServiceClient();
  const contact = await findOrCreateContact(service, {
    communeId: guard.communeId, nom: parsed.value.nom!, type: "financeur", categorie: "financeur", source: "saisie", createdBy: guard.userId,
  });
  const { data, error } = await service.from("financeurs_locaux")
    .insert({ ...parsed.value, commune_id: guard.communeId, contact_id: contact?.id ?? null, created_by: guard.userId })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit({ action: "financeur_local.created", targetType: "financeur_local", targetId: data.id, communeId: guard.communeId });
  return NextResponse.json({ financeur: data });
}
