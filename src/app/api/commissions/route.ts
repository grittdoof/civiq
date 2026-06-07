import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listCommissions } from "@/lib/projects/queries";

export async function GET() {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const commissions = await listCommissions(guard.communeId);
  return NextResponse.json({ commissions });
}

interface CreateBody {
  nom?: string;
  description?: string | null;
  responsable_user_id?: string | null;
  color?: string;
  icon?: string;
}

export async function POST(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }
  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const nom = body.nom?.trim();
  if (!nom) return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });
  const service = await createServiceClient();
  const { data, error } = await service
    .from("commissions")
    .insert({
      commune_id: guard.communeId,
      nom,
      description: body.description?.trim() || null,
      responsable_user_id: body.responsable_user_id || null,
      color: /^#[0-9A-Fa-f]{6}$/.test(body.color ?? "") ? body.color : "#5A8DEE",
      icon: body.icon?.trim() || "Gavel",
    })
    .select("*")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  return NextResponse.json({ commission: data });
}
