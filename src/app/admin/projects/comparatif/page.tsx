import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listProjects } from "@/lib/projects/queries";
import { PROJECT_PHASE_LABELS } from "@/lib/projects/types";
import { formatEuros } from "@/lib/projects/cost-calc";
import CostComparisonChart from "@/components/projects/CostComparisonChart";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/comparatif — Vue comparative des projets triée
// par coût global actualisé. Aide à l'arbitrage : un projet peu
// coûteux à l'investissement peut être le plus lourd sur 10 ans.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function ComparatifPage() {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const projects = await listProjects(ctx.communeId);

  // Coût global par projet via RPC
  const service = await createServiceClient();
  type GcRow = { invest: number; total_nominal: number; total_actualise: number };
  const enriched = await Promise.all(
    projects.map(async (p) => {
      const { data: gc } = await service.rpc("project_global_cost", { p_project_id: p.id });
      const row = (gc as GcRow[] | null)?.[0];
      const obtenu = p.financing_total_obtenu ?? 0;
      const invest = Number(row?.invest ?? p.budget_estime ?? 0);
      return {
        ...p,
        invest,
        total_nominal: Number(row?.total_nominal ?? invest),
        total_actualise: Number(row?.total_actualise ?? invest),
        reste_a_charge: invest - obtenu,
      };
    }),
  );

  // Tri par défaut : coût global actualisé décroissant
  enriched.sort((a, b) => b.total_actualise - a.total_actualise);

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Tous les projets
        </Link>
      </div>

      <h1 className="civiq-page-title">Comparatif des coûts</h1>
      <p className="pj-page-subtitle">
        Trié par <strong>coût global actualisé</strong> décroissant. Un projet
        peu coûteux à l&apos;investissement peut peser plus lourd sur 10 ans
        une fois exploitation et entretien intégrés.
      </p>

      {enriched.length === 0 ? (
        <div className="civiq-card pj-empty">
          <p className="pj-empty-title">Aucun projet à comparer.</p>
        </div>
      ) : (
        <>
          <section className="civiq-card pj-section">
            <h2 className="pj-section-title">Investissement vs coût global actualisé</h2>
            <CostComparisonChart
              rows={enriched.map((e) => ({
                id: e.id,
                titre: e.titre,
                invest: e.invest,
                total_nominal: e.total_nominal,
                total_actualise: e.total_actualise,
              }))}
            />
          </section>

          <section className="civiq-card pj-section pj-section-wide">
            <h2 className="pj-section-title">Détail par projet</h2>
            <table className="pj-table">
              <thead>
                <tr>
                  <th>Projet</th>
                  <th>Étape</th>
                  <th>Investissement</th>
                  <th>Coût global nominal</th>
                  <th>Coût global actualisé</th>
                  <th>Reste à charge commune</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/admin/projects/${e.id}`} className="pj-table-strong">
                        {e.titre}
                      </Link>
                    </td>
                    <td>{PROJECT_PHASE_LABELS[e.phase]}</td>
                    <td>{formatEuros(e.invest)}</td>
                    <td>{formatEuros(e.total_nominal)}</td>
                    <td className="pj-table-strong">{formatEuros(e.total_actualise)}</td>
                    <td>{formatEuros(e.reste_a_charge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
