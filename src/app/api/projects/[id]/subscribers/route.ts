import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_subscribers")
    .select("*, profile:profiles ( id, full_name )")
    .eq("project_id", id);
  return NextResponse.json({ subscribers: data ?? [] });
}

interface CreateBody { user_id?: string; }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!body.user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service
    .from("project_subscribers")
    .insert({ project_id: id, user_id: body.user_id });
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
