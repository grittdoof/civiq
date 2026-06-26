import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listProjects } from "@/lib/projects/queries";
import {
  PROJECT_PHASE_LABELS,
  type ProjectPhase,
} from "@/lib/projects/types";
import { formatEuros } from "@/lib/projects/cost-calc";
import PhaseIcon from "@/components/projects/PhaseIcon";
import ExportPpiButton from "@/components/projects/ExportPpiButton";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/ppi — Plan Pluriannuel d'Investissement
//
// Vision consolidée de tous les projets d'investissement de la
// commune, regroupés par année de programmation (date_creation
// par défaut, fallback année courante si non renseignée).
//
// Pour chaque opération : montant HT, subventions sollicitées,
// subventions obtenues, autofinancement, reste à charge, phase
// en cours.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

// Bonnes pratiques PPI : tableau N, N+1, N+2, N+3 — on couvre
// l'année courante + 3 années suivantes.
function programmingYear(p: { date_creation?: string | null }): number {
  if (p.date_creation) return new Date(p.date_creation).getFullYear();
  return new Date().getFullYear();
}

export default async function PpiPage() {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const projects = await listProjects(ctx.communeId);

  // Agrégats financement par projet (déjà précalculés par listProjects)
  const service = await createServiceClient();
  const { data: communeRow } = await service
    .from("communes")
    .select("name")
    .eq("id", ctx.communeId)
    .maybeSingle();
  const communeName = communeRow?.name ?? "Commune";

  // Filtre : on exclut les projets « accompagnement sans financement »
  // car ils n'entrent pas dans le PPI au sens financier.
  const ppiProjects = projects.filter((p) => !p.accompagne_sans_financer);

  // Groupement par année de programmation
  const byYear = new Map<number, typeof ppiProjects>();
  for (const p of ppiProjects) {
    const y = programmingYear(p);
    const arr = byYear.get(y) ?? [];
    arr.push(p);
    byYear.set(y, arr);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);

  // Totaux globaux
  const totals = ppiProjects.reduce(
    (acc, p) => {
      const budget = Number(p.budget_estime ?? 0);
      const demande = p.financing_total_demande ?? 0;
      const obtenu = p.financing_total_obtenu ?? 0;
      const reste = budget - obtenu;
      return {
        budget: acc.budget + budget,
        demande: acc.demande + demande,
        obtenu: acc.obtenu + obtenu,
        reste: acc.reste + reste,
      };
    },
    { budget: 0, demande: 0, obtenu: 0, reste: 0 },
  );

  return (
    <main className="civiq-main pj-projects-page">
      <div className="pj-ppi-header">
        <div>
          <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
            <ArrowLeft size={14} /> Gestion de projet
          </Link>
          <h1 className="civiq-page-title" style={{ marginTop: 8 }}>
            Plan Pluriannuel d&apos;Investissement
          </h1>
          <p className="pj-page-subtitle">
            Vision consolidée des investissements de {communeName}, regroupés
            par année de programmation. Pour chaque opération : montant HT,
            financements sollicités, obtenus, et reste à charge.
          </p>
        </div>
        <div className="pj-page-header-actions">
          <ExportPpiButton communeName={communeName} />
        </div>
      </div>

      {/* Totaux */}
      <section className="pj-summary-bar">
        <div className="pj-summary-card">
          <div className="pj-summary-label">Opérations</div>
          <div className="pj-summary-value">{ppiProjects.length}</div>
        </div>
        <div className="pj-summary-card">
          <div className="pj-summary-label">Investissement total HT</div>
          <div className="pj-summary-value">{formatEuros(totals.budget)}</div>
        </div>
        <div className="pj-summary-card">
          <div className="pj-summary-label">Subventions sollicitées</div>
          <div className="pj-summary-value">{formatEuros(totals.demande)}</div>
        </div>
        <div className="pj-summary-card">
          <div className="pj-summary-label">Subventions obtenues</div>
          <div className="pj-summary-value pj-summary-value-success">{formatEuros(totals.obtenu)}</div>
        </div>
        <div className="pj-summary-card">
          <div className="pj-summary-label">Reste à charge commune</div>
          <div className="pj-summary-value pj-summary-value-warn">{formatEuros(totals.reste)}</div>
        </div>
      </section>

      {ppiProjects.length === 0 ? (
        <div className="civiq-card pj-empty">
          <p className="pj-empty-title">Aucune opération à programmer</p>
          <p className="pj-empty-hint">
            Créez des projets d&apos;investissement pour construire votre PPI.
            Les projets « accompagnement sans financement » sont exclus du PPI.
          </p>
        </div>
      ) : (
        <div className="pj-ppi-content">
          <div className="pj-ppi-tip" role="note">
            <Info size={14} />
            <span>
              La <strong>programmation</strong> de chaque opération est déduite de sa date
              de création. Un champ « année cible » sera ajouté ultérieurement
              pour affiner la prospective.
            </span>
          </div>

          {years.map((year) => {
            const items = byYear.get(year) ?? [];
            const yearTotals = items.reduce(
              (acc, p) => {
                const budget = Number(p.budget_estime ?? 0);
                const obtenu = p.financing_total_obtenu ?? 0;
                return {
                  budget: acc.budget + budget,
                  obtenu: acc.obtenu + obtenu,
                  reste: acc.reste + (budget - obtenu),
                };
              },
              { budget: 0, obtenu: 0, reste: 0 },
            );
            return (
              <section key={year} className="pj-ppi-year">
                <header className="pj-ppi-year-header">
                  <h2 className="pj-ppi-year-title">Programmation {year}</h2>
                  <div className="pj-ppi-year-totals">
                    <span>
                      <span className="pj-ppi-year-label">Total HT</span>
                      <strong>{formatEuros(yearTotals.budget)}</strong>
                    </span>
                    <span>
                      <span className="pj-ppi-year-label">Subventions obtenues</span>
                      <strong className="pj-text-success">
                        {formatEuros(yearTotals.obtenu)}
                      </strong>
                    </span>
                    <span>
                      <span className="pj-ppi-year-label">Reste à charge</span>
                      <strong className="pj-text-warn">
                        {formatEuros(yearTotals.reste)}
                      </strong>
                    </span>
                  </div>
                </header>

                <table className="pj-table pj-ppi-table">
                  <thead>
                    <tr>
                      <th>Opération</th>
                      <th>Étape</th>
                      <th>Tiers</th>
                      <th className="pj-num">Montant HT</th>
                      <th className="pj-num">Subv. sollicitées</th>
                      <th className="pj-num">Subv. obtenues</th>
                      <th className="pj-num">Reste à charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => {
                      const budget = Number(p.budget_estime ?? 0);
                      const demande = p.financing_total_demande ?? 0;
                      const obtenu = p.financing_total_obtenu ?? 0;
                      const reste = budget - obtenu;
                      return (
                        <tr key={p.id}>
                          <td>
                            <Link
                              href={`/admin/projects/${p.id}`}
                              className="pj-ppi-link"
                            >
                              {p.titre}
                            </Link>
                          </td>
                          <td>
                            <div className="pj-list-phase-cell" style={{ gap: 6 }}>
                              <div className="pj-list-phase-badge" style={{ width: 22, height: 22 }}>
                                <PhaseIcon phase={p.phase as ProjectPhase} size={12} strokeWidth={2} />
                              </div>
                              <span style={{ fontSize: 12.5 }}>
                                {PROJECT_PHASE_LABELS[p.phase as ProjectPhase]}
                              </span>
                            </div>
                          </td>
                          <td>
                            {p.concerne_tiers ? (
                              <span className="pj-list-pill pj-list-pill-tiers">
                                {p.tiers_nom ?? "Tiers"}
                              </span>
                            ) : (
                              <span className="pj-list-muted">—</span>
                            )}
                          </td>
                          <td className="pj-num pj-num-strong">{formatEuros(budget)}</td>
                          <td className="pj-num">{formatEuros(demande)}</td>
                          <td className="pj-num pj-text-success">{formatEuros(obtenu)}</td>
                          <td className="pj-num pj-text-warn">{formatEuros(reste)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
