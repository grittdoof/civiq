import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { ATTRIBUTION, AVERTISSEMENT_SUGGESTION, suggererAides, type AideCache } from "@/lib/aides/aides";

// GET /api/aides/suggestions?titre=…&description=…
// Lit UNIQUEMENT le cache (jamais l'API Aides-territoires en direct).
// Ne renvoie ni montant ni taux : nom, organisme, thématiques, date limite, lien.

export async function GET(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });

  const titre = (req.nextUrl.searchParams.get("titre") ?? "").slice(0, 200);
  const description = (req.nextUrl.searchParams.get("description") ?? "").slice(0, 2000);
  const service = await createServiceClient();
  const [{ data: aides }, { data: sync }] = await Promise.all([
    service.from("aides_cache")
      .select("aide_id, nom, slug, url, url_candidature, financeurs, categories, types_aide, description, date_ouverture, date_limite, recurrence, appel_a_projets, perimetre, source_maj")
      .eq("commune_id", guard.communeId),
    service.from("aides_sync_log").select("finished_at").eq("commune_id", guard.communeId).eq("ok", true)
      .order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const suggestions = suggererAides((aides ?? []) as AideCache[], { titre, description }, today)
    .map(({ score: _score, description: _d, ...a }) => a);
  return NextResponse.json({
    suggestions,
    mis_a_jour_le: sync?.finished_at ?? null,
    attribution: ATTRIBUTION,
    avertissement: AVERTISSEMENT_SUGGESTION,
  });
}
