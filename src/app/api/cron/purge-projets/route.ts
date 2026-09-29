import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { cronAutorise } from "@/lib/aides/sync";
import { CORBEILLE_JOURS, purgerProjet } from "@/lib/projects/corbeille";

// Cron quotidien (vercel.json) — suppression définitive des projets restés
// plus de 30 jours dans la corbeille. Sauvegarde JSON + fichiers d'abord ;
// en cas d'échec, le projet reste dans la corbeille (nouvel essai demain).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = cronAutorise(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = await createServiceClient();
  const limite = new Date(Date.now() - CORBEILLE_JOURS * 86_400_000).toISOString();
  const { data } = await service.from("projects").select("id, commune_id, titre").not("deleted_at", "is", null).lt("deleted_at", limite).limit(20);
  const resultats: Array<Record<string, unknown>> = [];
  for (const p of data ?? []) {
    try {
      const r = await purgerProjet(service, p.id as string);
      await service.from("audit_log").insert({
        commune_id: p.commune_id, action: "project.purged", target_type: "project", target_id: p.id,
        metadata: { titre: p.titre, ...r, declencheur: "automatique_30_jours" },
      });
      resultats.push({ id: p.id, ok: true });
    } catch (e) {
      console.error("[purge-projets]", p.id, e);
      resultats.push({ id: p.id, ok: false, erreur: e instanceof Error ? e.message : "inconnue" });
    }
  }
  return NextResponse.json({ purges: resultats.length, resultats });
}
