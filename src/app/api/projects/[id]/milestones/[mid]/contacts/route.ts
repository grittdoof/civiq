import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

// POST   /api/projects/:id/milestones/:mid/contacts   { contact_id }
// DELETE /api/projects/:id/milestones/:mid/contacts?contact_id=…
// Parties prenantes d'une étape (annuaire unique `contacts`).

interface RouteParams { params: Promise<{ id: string; mid: string }>; }

async function checkMilestone(service: Awaited<ReturnType<typeof createServiceClient>>, projectId: string, mid: string) {
  const { data } = await service
    .from("milestones").select("id").eq("id", mid).eq("project_id", projectId).is("deleted_at", null).maybeSingle();
  return !!data;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  let body: { contact_id?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!body.contact_id) return NextResponse.json({ error: "contact_id requis" }, { status: 400 });

  const service = await createServiceClient();
  if (!(await checkMilestone(service, id, mid))) return NextResponse.json({ error: "Étape introuvable" }, { status: 404 });
  const { data: contact } = await service
    .from("contacts").select("id").eq("id", body.contact_id).eq("commune_id", access.communeId).is("deleted_at", null).maybeSingle();
  if (!contact) return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });

  const { error } = await service.from("milestone_contacts").insert({ milestone_id: mid, contact_id: body.contact_id });
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const contactId = req.nextUrl.searchParams.get("contact_id");
  if (!contactId) return NextResponse.json({ error: "contact_id requis" }, { status: 400 });

  const service = await createServiceClient();
  if (!(await checkMilestone(service, id, mid))) return NextResponse.json({ error: "Étape introuvable" }, { status: 404 });
  // Lien sans historique propre : suppression réelle du rattachement (le contact reste).
  const { error } = await service.from("milestone_contacts").delete().eq("milestone_id", mid).eq("contact_id", contactId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
