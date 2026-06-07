import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { getCommuneSettings, upsertCommuneSettings } from "@/lib/projects/queries";

// GET   /api/commune-settings — taux inflation/actualisation de la commune
// PATCH /api/commune-settings — upsert (admin only)

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ctx.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const settings = await getCommuneSettings(ctx.communeId);
  return NextResponse.json({
    settings: settings ?? {
      commune_id: ctx.communeId,
      taux_inflation: 2.0,
      taux_actualisation: 4.0,
      updated_at: null,
    },
  });
}

interface PatchBody {
  taux_inflation?: number;
  taux_actualisation?: number;
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ctx.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "super_admin"].includes(ctx.role ?? "")) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  let body: PatchBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const taux_inflation = sanitize(body.taux_inflation, 2.0);
  const taux_actualisation = sanitize(body.taux_actualisation, 4.0);

  const settings = await upsertCommuneSettings(
    ctx.communeId,
    taux_inflation,
    taux_actualisation,
  );
  return NextResponse.json({ settings });
}

function sanitize(n: number | undefined, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return n;
}
