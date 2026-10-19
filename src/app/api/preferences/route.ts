import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { CLE_PREFS_LISTE, lirePreferencesListe } from "@/lib/projects/preferences";

// ═══════════════════════════════════════════════════════════════
// PUT /api/preferences — { cle: "projets_liste", valeur: {...} }
// Préférences d'affichage de l'utilisateur connecté (son profil
// uniquement). Clés en liste blanche, valeurs normalisées.
// ═══════════════════════════════════════════════════════════════

const LECTEURS: Record<string, (raw: unknown) => unknown> = {
  [CLE_PREFS_LISTE]: lirePreferencesListe,
};

export async function PUT(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { cle?: unknown; valeur?: unknown };
  const lire = typeof body.cle === "string" ? LECTEURS[body.cle] : undefined;
  if (!lire) return NextResponse.json({ error: "Préférence inconnue" }, { status: 400 });
  const valeur = lire(body.valeur);

  const service = await createServiceClient();
  const { data: prof } = await service.from("profiles").select("preferences").eq("id", ctx.userId).maybeSingle();
  const prefs = { ...((prof?.preferences as Record<string, unknown> | null) ?? {}), [body.cle as string]: valeur };
  const { error } = await service.from("profiles").update({ preferences: prefs }).eq("id", ctx.userId);
  if (error) {
    console.error("[preferences] PUT:", error);
    return NextResponse.json({ error: "Préférence non enregistrée" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, valeur });
}
