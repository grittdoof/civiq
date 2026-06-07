import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getCommission } from "@/lib/projects/queries";

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const { id } = await params;
  const detail = await getCommission(guard.communeId, id);
  if (!detail.commission) return NextResponse.json({ error: "Commission introuvable" }, { status: 404 });
  return NextResponse.json(detail);
}

interface PatchBody {
  nom?: string;
  description?: string | null;
  responsable_user_id?: string | null;
  active?: boolean;
  color?: string;
  icon?: string;
  parent_id?: string | null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  // L'édition d'une commission est ouverte aux éditeurs (élus/agents)
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }
  const { id } = await params;
  let body: PatchBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const updates: Record<string, unknown> = {};
  if (typeof body.nom === "string") updates.nom = body.nom.trim();
  if ("description" in body) updates.description = body.description?.trim() || null;
  if ("responsable_user_id" in body) updates.responsable_user_id = body.responsable_user_id || null;
  if (typeof body.active === "boolean") updates.active = body.active;
  if (typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color)) {
    updates.color = body.color;
  }
  if (typeof body.icon === "string" && body.icon.trim()) {
    updates.icon = body.icon.trim();
  }
  if ("parent_id" in body) {
    // Empêche qu'une commission ait elle-même comme parent
    if (body.parent_id && body.parent_id === id) {
      return NextResponse.json(
        { error: "Une commission ne peut pas être sa propre sous-commission." },
        { status: 400 },
      );
    }
    updates.parent_id = body.parent_id || null;
  }
  const service = await createServiceClient();
  const { data, error } = await service
    .from("commissions")
    .update(updates)
    .eq("id", id)
    .eq("commune_id", guard.communeId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Commission introuvable" }, { status: 404 });
  return NextResponse.json({ commission: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  // Suppression : admin commune ou super_admin
  if (!["admin", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }
  const { id } = await params;
  const service = await createServiceClient();
  const { error } = await service.from("commissions").delete().eq("id", id).eq("commune_id", guard.communeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
