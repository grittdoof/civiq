import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info, Archive } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { chargerPortefeuille } from "@/lib/projects/portefeuille-server";
import { construirePpi, type LignePpi } from "@/lib/projects/ppi";
import { formatEuros } from "@/lib/projects/cost-calc";
import ExportPpiButton from "@/components/projects/ExportPpiButton";
import PpiInclusionToggle from "@/components/projects/PpiInclusionToggle";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/ppi — Plan pluriannuel d'investissement (PPI)
//
// Projets de type investissement, regroupés par année d'échéance
// souhaitée (à défaut, année de création). Montants hors taxes issus
// du budget du projet (lib/projects/ppi.ts, commun avec l'export PDF).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function PpiPage() {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const [pf, service] = await Promise.all([chargerPortefeuille(ctx.communeId), createServiceClient()]);
  const { data: communeRow } = await service.from("communes").select("name").eq("id", ctx.communeId).maybeSingle();
  const communeName = communeRow?.name ?? "Commune";
  const ppi = construirePpi({
    projets: pf.items,
    lignesParProjet: pf.lignesParProjet,
    subventionsParProjet: pf.subventionsParProjet,
    statuts: pf.statuts,
  });
  const avecEstimation = ppi.annees.some((a) => a.lignes.some((l) => l.estimation));

  const Montant = ({ l }: { l: LignePpi }) => (
    <>
      {formatEuros(l.montantHt)}
      {l.estimation && l.montantHt > 0 && <span className="pj-list-muted"> *</span>}
    </>
  );

  return (
    <main className="civiq-main pj-projects-page">
      <div className="pj-ppi-header">
        <div>
          <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
            <ArrowLeft size={14} aria-hidden="true" /> Gestion de projet
          </Link>
          <h1 className="civiq-page-title" style={{ marginTop: 8 }}>
            Plan pluriannuel d&apos;investissement (PPI)
          </h1>
          <p className="pj-page-subtitle">
            Les investissements de {communeName}, année par année : montant hors taxes, subventions sollicitées
            et obtenues, reste à charge de la commune.
          </p>
        </div>
        <div className="pj-page-header-actions">
          <ExportPpiButton communeName={communeName} />
        </div>
      </div>

      <section className="pj-summary-bar">
        <div className="pj-summary-card"><div className="pj-summary-label">Opérations</div><div className="pj-summary-value">{ppi.total.operations}</div></div>
        <div className="pj-summary-card"><div className="pj-summary-label">Investissement total HT</div><div className="pj-summary-value">{formatEuros(ppi.total.montantHt)}</div></div>
        <div className="pj-summary-card"><div className="pj-summary-label">Subventions sollicitées</div><div className="pj-summary-value">{formatEuros(ppi.total.sollicite)}</div></div>
        <div className="pj-summary-card"><div className="pj-summary-label">Subventions obtenues</div><div className="pj-summary-value pj-summary-value-success">{formatEuros(ppi.total.obtenu)}</div></div>
        <div className="pj-summary-card"><div className="pj-summary-label">Reste à charge commune</div><div className="pj-summary-value pj-summary-value-warn">{formatEuros(ppi.total.reste)}</div></div>
      </section>

      {ppi.total.operations === 0 && ppi.exclus.length === 0 ? (
        <div className="civiq-card pj-empty">
          <p className="pj-empty-title">Aucun investissement à programmer</p>
          <p className="pj-empty-hint">
            Le PPI reprend les projets de type « Investissement ». Les événements et les suivis simples n&apos;y figurent pas.
          </p>
        </div>
      ) : (
        <div className="pj-ppi-content">
          <div className="pj-ppi-tip" role="note">
            <Info size={14} aria-hidden="true" />
            <span>
              Chaque opération est programmée l&apos;année de son <strong>échéance souhaitée</strong> (modifiable sur la fiche du projet),
              à défaut l&apos;année de sa création.
              {avecEstimation && " * Montant issu de l'estimation initiale : saisissez le budget du projet pour l'affiner."}
            </span>
          </div>

          {ppi.annees.map(({ annee, lignes, total }) => (
            <section key={annee} className="pj-ppi-year">
              <header className="pj-ppi-year-header">
                <h2 className="pj-ppi-year-title">Programmation {annee}</h2>
                <div className="pj-ppi-year-totals">
                  <span><span className="pj-ppi-year-label">Total HT</span> <strong>{formatEuros(total.montantHt)}</strong></span>
                  <span><span className="pj-ppi-year-label">Subventions obtenues</span> <strong className="pj-text-success">{formatEuros(total.obtenu)}</strong></span>
                  <span><span className="pj-ppi-year-label">Reste à charge</span> <strong className="pj-text-warn">{formatEuros(total.reste)}</strong></span>
                </div>
              </header>
              <div className="pj-stats-table-wrap">
                <table className="pj-table pj-ppi-table">
                  <thead>
                    <tr>
                      <th scope="col">Opération</th>
                      <th scope="col">Où en est-on ?</th>
                      <th scope="col">Tiers</th>
                      <th scope="col" className="pj-num">Montant HT</th>
                      <th scope="col" className="pj-num">Subv. sollicitées</th>
                      <th scope="col" className="pj-num">Subv. obtenues</th>
                      <th scope="col" className="pj-num">Reste à charge</th>
                      <th scope="col"><span className="pj-sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.id}>
                        <td><Link href={`/admin/projects/${l.id}`} className="pj-ppi-link">{l.titre}</Link></td>
                        <td>{l.etat}</td>
                        <td>{l.tiers ? <span className="pj-list-pill pj-list-pill-tiers">{l.tiers}</span> : <span className="pj-list-muted">—</span>}</td>
                        <td className="pj-num pj-num-strong"><Montant l={l} /></td>
                        <td className="pj-num">{formatEuros(l.sollicite)}</td>
                        <td className="pj-num pj-text-success">{formatEuros(l.obtenu)}</td>
                        <td className="pj-num pj-text-warn">{formatEuros(l.reste)}</td>
                        <td className="pj-ppi-action-cell"><PpiInclusionToggle projectId={l.id} variant="remove" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {ppi.exclus.length > 0 && (
            <section className="pj-ppi-excluded">
              <header className="pj-ppi-excluded-header">
                <div className="pj-ppi-excluded-icon" aria-hidden="true"><Archive size={16} /></div>
                <div>
                  <h2 className="pj-ppi-excluded-title">Investissements retirés du PPI ({ppi.exclus.length})</h2>
                  <p className="pj-ppi-excluded-hint">
                    Ils restent dans le portefeuille mais ne sont pas programmés. Réintégrez-les s&apos;ils redeviennent d&apos;actualité.
                  </p>
                </div>
              </header>
              <ul className="pj-ppi-excluded-list">
                {ppi.exclus.map((l) => (
                  <li key={l.id} className="pj-ppi-excluded-item">
                    <Link href={`/admin/projects/${l.id}`} className="pj-ppi-excluded-link">
                      <strong>{l.titre}</strong>
                      <span className="pj-ppi-excluded-meta">{l.etat} · {formatEuros(l.montantHt)}</span>
                    </Link>
                    <PpiInclusionToggle projectId={l.id} variant="restore" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
