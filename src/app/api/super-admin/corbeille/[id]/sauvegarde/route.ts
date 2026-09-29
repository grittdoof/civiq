import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";
import { snapshotProjet } from "@/lib/projects/corbeille";
import { nomFichier } from "@/lib/projects/fiche";

// GET /api/super-admin/corbeille/:id/sauvegarde — sauvegarde JSON complète
// du projet (toutes ses lignes), à télécharger.

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  const { id } = await params;
  const service = await createServiceClient();
  try {
    const snap = await snapshotProjet(service, id);
    if (!snap.project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
    const nom = nomFichier(snap.project.titre, `sauvegarde-${new Date().toISOString().slice(0, 10)}`, "pdf").replace(/\.pdf$/, ".json");
    return new NextResponse(JSON.stringify(snap, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nom}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sauvegarde impossible" }, { status: 500 });
  }
}
