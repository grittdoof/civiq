import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import type { StakeholderType } from "@/lib/projects/types";

// GET  /api/stakeholders     — annuaire commune (réutilisable)
// POST /api/stakeholders     — crée un stakeholder pour la commune

export async function GET() {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const service = await createServiceClient();
  const { data } = await service
    .from("stakeholders")
    .select("*")
    .eq("commune_id", guard.communeId)
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
    .from("stakeholders")
    .insert({
      commune_id: guard.communeId,
      nom,
      organisation: body.organisation?.trim() || null,
      email: body.email?.trim() || null,
      telephone: body.telephone?.trim() || null,
      type: body.type ?? "institutionnelle",
    })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  return NextResponse.json({ stakeholder: data });
}
