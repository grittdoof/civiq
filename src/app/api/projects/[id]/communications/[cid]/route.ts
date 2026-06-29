import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import type { CommunicationCanal, CommunicationStatus } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string; cid: string }>; }

const ALLOWED_CANAUX = new Set<CommunicationCanal>([
  "affiche", "presse", "reseaux", "site", "agenda", "mailing", "panneau", "autre",
]);
const ALLOWED_STATUTS = new Set<CommunicationStatus>(["a_faire", "planifie", "diffuse"]);

interface PatchBody {
  canal?: CommunicationCanal;
  libelle?: string;
  date_prevue?: string | null;
  date_diffusion?: string | null;
  statut?: CommunicationStatus;
  lien?: string | null;
  notes?: string | null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, cid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: PatchBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.canal) {
    if (!ALLOWED_CANAUX.has(body.canal)) return NextResponse.json({ error: "Canal invalide" }, { status: 400 });
    updates.canal = body.canal;
  }
  if (typeof body.libelle === "string") {
    const t = body.libelle.trim();
    if (!t) return NextResponse.json({ error: "Libellé vide" }, { status: 400 });
    updates.libelle = t;
  }
  if ("date_prevue" in body) updates.date_prevue = body.date_prevue || null;
  if ("date_diffusion" in body) updates.date_diffusion = body.date_diffusion || null;
  if (body.statut) {
    if (!ALLOWED_STATUTS.has(body.statut)) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    updates.statut = body.statut;
  }
  if ("lien" in body) updates.lien = body.lien?.trim() || null;
  if ("notes" in body) updates.notes = body.notes?.trim() || null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_communications")
    .update(updates)
    .eq("id", cid)
    .eq("project_id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Communication introuvable" }, { status: 404 });
  return NextResponse.json({ communication: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, cid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("project_communications")
    .delete()
    .eq("id", cid)
    .eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
