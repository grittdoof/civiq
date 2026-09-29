import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { chargerPortefeuille } from "@/lib/projects/portefeuille-server";
import { construirePpi } from "@/lib/projects/ppi";
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

  // Investissements uniquement : le coût global (exploitation, entretien
  // sur 10 ans) n'a de sens que pour un équipement ou un ouvrage.
  const pf = await chargerPortefeuille(ctx.communeId);
  const ppi = construirePpi({
    projets: pf.items.map((p) => ({ ...p, in_ppi: true })),
    lignesParProjet: pf.lignesParProjet,
    subventionsParProjet: pf.subventionsParProjet,
    statuts: pf.statuts,
  });
  const lignes = ppi.annees.flatMap((a) => a.lignes);

  const service = await createServiceClient();
  type GcRow = { invest: number; total_nominal: number; total_actualise: number };
  const enriched = await Promise.all(
    lignes.map(async (l) => {
      const { data: gc } = await service.rpc("project_global_cost", { p_project_id: l.id });
      const row = (gc as GcRow[] | null)?.[0];
      // La RPC part de l'ancienne enveloppe estimée : on lui substitue le
      // budget HT du projet et on garde les coûts d'exploitation calculés.
      const rpcInvest = Number(row?.invest ?? 0);
      const exploitationNominal = Number(row?.total_nominal ?? rpcInvest) - rpcInvest;
      const exploitationActualise = Number(row?.total_actualise ?? rpcInvest) - rpcInvest;
      return {
        id: l.id,
        titre: l.titre,
        etat: l.etat,
        invest: l.montantHt,
        total_nominal: l.montantHt + exploitationNominal,
        total_actualise: l.montantHt + exploitationActualise,
        reste_a_charge: l.reste,
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
        Investissements triés par <strong>coût global actualisé</strong> (hors taxes) : un projet peu coûteux à
        construire peut peser plus lourd sur 10 ans, une fois l&apos;entretien et le fonctionnement intégrés.
      </p>

      {enriched.length === 0 ? (
        <div className="civiq-card pj-empty">
          <p className="pj-empty-title">Aucun investissement à comparer.</p>
          <p className="pj-empty-hint">Le comparatif ne concerne que les projets de type « Investissement ».</p>
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
                  <th scope="col">Projet</th>
                  <th scope="col">Où en est-on ?</th>
                  <th scope="col">Investissement HT</th>
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
                    <td>{e.etat}</td>
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
