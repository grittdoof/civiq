import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getCommuneSettings } from "@/lib/projects/queries";
import FinanceursLocauxManager from "@/components/projects/FinanceursLocauxManager";
import type { FinanceurLocal } from "@/lib/aides/financeurs-locaux";

// /admin/projects/financeurs — sources de financement de la commune :
// cache Aides-territoires (état, actualisation) + fiches locales.

export const dynamic = "force-dynamic";

export default async function FinanceursPage() {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const service = await createServiceClient();
  const [settings, { data: locaux }, { data: sync }, { count }] = await Promise.all([
    getCommuneSettings(ctx.communeId),
    service.from("financeurs_locaux").select("id, nom, contact_id, types_projet, periode_depot, lien, notes")
      .eq("commune_id", ctx.communeId).is("deleted_at", null).order("nom"),
    service.from("aides_sync_log").select("finished_at, ok, nb_aides, erreur").eq("commune_id", ctx.communeId)
      .order("started_at", { ascending: false }).limit(1).maybeSingle(),
    service.from("aides_cache").select("aide_id", { count: "exact", head: true }).eq("commune_id", ctx.communeId),
  ]);

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} aria-hidden="true" /> Tous les projets
        </Link>
      </div>
      <h1 className="civiq-page-title">Financeurs</h1>
      <p className="pj-page-subtitle">Les sources d&apos;aides proposées sur vos projets.</p>
      <FinanceursLocauxManager
        initial={(locaux ?? []) as FinanceurLocal[]}
        canEdit={ctx.role === "admin" || ctx.role === "super_admin"}
        sync={sync as never}
        nbAides={count ?? 0}
        codeInsee={settings.code_insee}
      />
    </main>
  );
}
