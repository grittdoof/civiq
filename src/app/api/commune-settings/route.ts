import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { getCommuneSettings } from "@/lib/projects/queries";
import { validateParametresPatch } from "@/lib/projects/commune-parametres";

// GET   /api/commune-settings — paramètres projets de la commune
// PATCH /api/commune-settings — mise à jour partielle (admin commune / super-admin)
//
// Un PATCH ne touche que les champs envoyés (auparavant, un envoi
// partiel remettait l'autre taux à sa valeur par défaut).

export async function GET() {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const settings = await getCommuneSettings(guard.communeId);
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Réservé aux administrateurs de la commune" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const current = await getCommuneSettings(guard.communeId);
  const result = validateParametresPatch(body, current);
  if (!result.ok) return NextResponse.json({ error: "Certains champs sont invalides", fields: result.errors }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service
    .from("commune_settings")
    .upsert({ commune_id: guard.communeId, ...result.updates, updated_by: guard.userId }, { onConflict: "commune_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    action: "commune.project_settings.updated",
    targetType: "commune",
    targetId: guard.communeId,
    communeId: guard.communeId,
    metadata: { fields: Object.keys(result.updates) },
  });

  return NextResponse.json({ settings: await getCommuneSettings(guard.communeId) });
}
