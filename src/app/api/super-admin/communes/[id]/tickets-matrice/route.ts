import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import {
  FONCTIONS_MATRICE, MATRICE_DEFAUT, normaliserLigne, type LigneMatrice,
} from "@/lib/tickets/droits";

// ═══════════════════════════════════════════════════════════════
// GET|PUT /api/super-admin/communes/:id/tickets-matrice (lot 1)
// Matrice fonction × action du module Tickets d'une commune.
// Réservé au super-admin. Une fonction sans ligne vaut « rien ».
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  const { id } = await params;
  const service = await createServiceClient();
  const { data, error } = await service
    .from("ticket_matrice")
    .select("fonction, voit, voit_restreints, actions, updated_at")
    .eq("commune_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const lues = new Map((data ?? []).map((r) => [r.fonction as string, normaliserLigne(r)]));
  const lignes = FONCTIONS_MATRICE.map(({ fonction }) =>
    lues.get(fonction) ?? { ...MATRICE_DEFAUT.find((l) => l.fonction === fonction)!, voit: "rien" as const });
  const maj = (data ?? []).map((r) => r.updated_at as string).sort().pop() ?? null;
  return NextResponse.json({ lignes, defaut: MATRICE_DEFAUT, mis_a_jour: maj });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { lignes?: unknown } | null;
  if (!body || !Array.isArray(body.lignes)) return NextResponse.json({ error: "Matrice invalide" }, { status: 400 });

  const connues = new Set(FONCTIONS_MATRICE.map((f) => f.fonction));
  const lignes: LigneMatrice[] = [];
  for (const brut of body.lignes as Array<Record<string, unknown>>) {
    if (!brut || typeof brut.fonction !== "string" || !connues.has(brut.fonction as LigneMatrice["fonction"])) {
      return NextResponse.json({ error: "Fonction inconnue" }, { status: 400 });
    }
    lignes.push(normaliserLigne({
      fonction: brut.fonction, voit: String(brut.voit ?? "rien"),
      voit_restreints: brut.voit_restreints === true, actions: brut.actions,
    }));
  }

  const service = await createServiceClient();
  const { data: commune } = await service.from("communes").select("id").eq("id", id).maybeSingle();
  if (!commune) return NextResponse.json({ error: "Commune introuvable" }, { status: 404 });

  const now = new Date().toISOString();
  const { error } = await service.from("ticket_matrice").upsert(
    lignes.map((l) => ({
      commune_id: id, fonction: l.fonction, voit: l.voit, voit_restreints: l.voit_restreints,
      actions: l.actions, updated_at: now, updated_by: ctx!.userId,
    })),
    { onConflict: "commune_id,fonction" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    action: "tickets.matrice_modifiee", targetType: "commune", targetId: id, communeId: id,
    metadata: { lignes: lignes.map((l) => ({ fonction: l.fonction, voit: l.voit, restreints: l.voit_restreints })) },
  });
  return NextResponse.json({ ok: true, mis_a_jour: now });
}
