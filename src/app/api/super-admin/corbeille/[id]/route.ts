import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { purgerProjet } from "@/lib/projects/corbeille";
import { synchroniserAgendasApres } from "@/lib/calendar/after-change";

// POST   /api/super-admin/corbeille/:id — restaurer le projet
// DELETE /api/super-admin/corbeille/:id — suppression définitive
//        (sauvegarde JSON + fichiers dans `project-archives` d'abord)

export const maxDuration = 60;

interface RouteParams { params: Promise<{ id: string }> }

async function projetCorbeille(id: string) {
  const service = await createServiceClient();
  const { data } = await service.from("projects").select("id, commune_id, titre").eq("id", id).not("deleted_at", "is", null).maybeSingle();
  return { service, projet: data as { id: string; commune_id: string; titre: string } | null };
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  const { id } = await params;
  const { service, projet } = await projetCorbeille(id);
  if (!projet) return NextResponse.json({ error: "Projet absent de la corbeille" }, { status: 404 });
  const { error } = await service.from("projects").update({ deleted_at: null, deleted_by: null, suppression_motif: null }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit({ action: "project.restored", targetType: "project", targetId: id, communeId: projet.commune_id, metadata: { titre: projet.titre } });
  synchroniserAgendasApres(projet.commune_id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  const { id } = await params;
  const { service, projet } = await projetCorbeille(id);
  if (!projet) return NextResponse.json({ error: "Projet absent de la corbeille" }, { status: 404 });
  try {
    const r = await purgerProjet(service, id);
    await writeAudit({ action: "project.purged", targetType: "project", targetId: id, communeId: projet.commune_id, metadata: { titre: projet.titre, ...r, declencheur: "super_admin" } });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[corbeille] purge", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Suppression impossible" }, { status: 500 });
  }
}
