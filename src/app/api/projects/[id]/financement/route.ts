import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/projects/:id/financement — plan de financement calculé côté
// serveur (project_financement, migration 041) : fait foi pour les deux
// contrôles (part communale ≥ 20 %, aides publiques ≤ 80 %).

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data, error } = await service.rpc("project_financement", { p_project_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}
