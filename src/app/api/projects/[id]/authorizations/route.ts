import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import type { AuthorizationStatus, AuthorizationType, ProjectPhase } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string }>; }

const ALLOWED_TYPES = new Set<AuthorizationType>([
  "arrete_municipal", "declaration_prefecture", "sacem", "securite",
  "erp", "debit_boisson", "autre",
]);
const ALLOWED_STATUTS = new Set<AuthorizationStatus>([
  "a_obtenir", "depose", "obtenu", "refuse",
]);

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_authorizations")
    .select("*")
    .eq("project_id", id)
    .order("echeance", { ascending: true, nullsFirst: false });
  return NextResponse.json({ authorizations: data ?? [] });
}

interface CreateBody {
  phase?: ProjectPhase;
  type?: AuthorizationType;
  libelle?: string;
  statut?: AuthorizationStatus;
  echeance?: string | null;
  obtenu_le?: string | null;
  document_id?: string | null;
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
  if (!body.type || !ALLOWED_TYPES.has(body.type)) return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  const statut = body.statut ?? "a_obtenir";
  if (!ALLOWED_STATUTS.has(statut)) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_authorizations")
    .insert({
      project_id: id,
      phase: body.phase,
      type: body.type,
      libelle,
      statut,
      echeance: body.echeance || null,
      obtenu_le: body.obtenu_le || null,
      document_id: body.document_id || null,
      notes: body.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  await writeAudit({
    action: "project.authorization.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { authorization_id: data.id, phase: body.phase },
  });
  return NextResponse.json({ authorization: data });
}
