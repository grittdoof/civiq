import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import type { CommunicationCanal, CommunicationStatus, ProjectPhase } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string }>; }

const ALLOWED_CANAUX = new Set<CommunicationCanal>([
  "affiche", "presse", "reseaux", "site", "agenda", "mailing", "panneau", "autre",
]);
const ALLOWED_STATUTS = new Set<CommunicationStatus>(["a_faire", "planifie", "diffuse"]);

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_communications")
    .select("*")
    .eq("project_id", id)
    .order("date_prevue", { ascending: true, nullsFirst: false });
  return NextResponse.json({ communications: data ?? [] });
}

interface CreateBody {
  phase?: ProjectPhase;
  canal?: CommunicationCanal;
  libelle?: string;
  date_prevue?: string | null;
  date_diffusion?: string | null;
  statut?: CommunicationStatus;
  lien?: string | null;
  notes?: string | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const libelle = body.libelle?.trim();
  if (!libelle) return NextResponse.json({ error: "Libellé requis" }, { status: 400 });
  if (!body.phase) return NextResponse.json({ error: "Phase requise" }, { status: 400 });
  if (!body.canal || !ALLOWED_CANAUX.has(body.canal)) return NextResponse.json({ error: "Canal invalide" }, { status: 400 });
  const statut = body.statut ?? "a_faire";
  if (!ALLOWED_STATUTS.has(statut)) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_communications")
    .insert({
      project_id: id,
      phase: body.phase,
      canal: body.canal,
      libelle,
      date_prevue: body.date_prevue || null,
      date_diffusion: body.date_diffusion || null,
      statut,
      lien: body.lien?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  await writeAudit({
    action: "project.communication.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { communication_id: data.id, phase: body.phase },
  });
  return NextResponse.json({ communication: data });
}
