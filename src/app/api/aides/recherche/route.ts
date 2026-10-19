import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { getCommuneSettings } from "@/lib/projects/queries";
import { filtrerResultats, normaliserMotsCles } from "@/lib/aides/aides";
import { jetonEnCache, oublierJeton, rechercherAidesApi } from "@/lib/aides/sync";

// ═══════════════════════════════════════════════════════════════
// GET /api/aides/recherche?q=mots-clés
// Recherche à la demande dans Aides-territoires (côté serveur : la clé
// API ne quitte jamais le serveur), sur le périmètre de la commune (code
// INSEE des paramètres). Aides encore ouvertes, 30 au plus. Ne renvoie
// ni montant ni taux (brief §2.9).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });

  const q = normaliserMotsCles(req.nextUrl.searchParams.get("q"));
  if (!q) return NextResponse.json({ error: "Saisissez au moins deux caractères." }, { status: 400 });

  const apiKey = process.env.AIDES_TERRITOIRES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "La recherche Aides-territoires n'est pas configurée sur la plateforme." }, { status: 503 });
  const settings = await getCommuneSettings(guard.communeId);
  if (!settings.code_insee) {
    return NextResponse.json({ error: "Renseignez le code INSEE de la commune dans les paramètres du module Projets pour lancer une recherche." }, { status: 409 });
  }

  try {
    let aides;
    try {
      aides = await rechercherAidesApi(await jetonEnCache(apiKey), settings.code_insee, q);
    } catch (e) {
      // Jeton expiré ou révoqué : un nouvel essai avec un jeton neuf.
      if (!(e instanceof Error) || !/HTTP 401|HTTP 403/.test(e.message)) throw e;
      oublierJeton();
      aides = await rechercherAidesApi(await jetonEnCache(apiKey), settings.code_insee, q);
    }
    // Description raccourcie : elle est conservée sur la demande si l'élu en prépare une.
    const resultats = filtrerResultats(aides, new Date().toISOString().slice(0, 10))
      .map((a) => ({ ...a, description: a.description ? a.description.slice(0, 1200) : null }));
    return NextResponse.json({ q, resultats }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[aides] recherche:", e);
    return NextResponse.json({ error: "Aides-territoires ne répond pas pour l'instant. Réessayez dans un moment." }, { status: 502 });
  }
}
