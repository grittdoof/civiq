import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import type { StakeholderType } from "@/lib/projects/types";
import { contactTypeFromCategorie } from "@/lib/projects/contacts";
import { STAKEHOLDER_COLUMNS } from "@/lib/projects/queries";

// GET  /api/stakeholders     — annuaire commune (réutilisable)
// POST /api/stakeholders     — crée une partie prenante pour la commune
//
// Depuis la migration 039, les parties prenantes sont des lignes de
// l'annuaire unique `contacts` ; la forme de réponse est inchangée
// (`type` = catégorie de partie prenante).

export async function GET() {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const service = await createServiceClient();
  const { data } = await service
    .from("contacts")
    .select(STAKEHOLDER_COLUMNS)
    .eq("commune_id", guard.communeId)
    .is("deleted_at", null)
    .order("nom");
  return NextResponse.json({ stakeholders: data ?? [] });
}

interface CreateBody {
  nom?: string;
  organisation?: string | null;
  email?: string | null;
  telephone?: string | null;
  type?: StakeholderType;
}

export async function POST(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const nom = body.nom?.trim();
  if (!nom) return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("contacts")
    .insert({
      commune_id: guard.communeId,
      nom,
      organisation: body.organisation?.trim() || null,
      email: body.email?.trim() || null,
      telephone: body.telephone?.trim() || null,
      categorie: body.type ?? "institutionnelle",
      type: contactTypeFromCategorie(body.type ?? "institutionnelle"),
      source: "saisie",
      created_by: guard.userId,
    })
    .select(STAKEHOLDER_COLUMNS)
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  return NextResponse.json({ stakeholder: data });
}
