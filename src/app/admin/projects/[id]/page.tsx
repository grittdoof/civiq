import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Ticket, ExternalLink } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { getProject } from "@/lib/projects/queries";
import {
  PROJECT_PHASE_LABELS,
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_TYPE_LABELS,
  FINANCING_STATUS_LABELS,
  type ProjectPhase,
} from "@/lib/projects/types";
import { computeEcart, formatEuros, formatPercent } from "@/lib/projects/cost-calc";
import ProjectStepper from "@/components/projects/ProjectStepper";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/:id — Fiche projet en LECTURE
//
// Affiche toutes les sections : identité, stepper, objectifs,
// parties prenantes (RACI), plan de financement, coûts 10 ans
// + coût global, jalons, abonnés, bilan, documents, historique
// des transitions, lien vers le ticket d'origine.
//
// L'édition se fait via :
//   • /admin/projects/:id/edit          (champs scalaires)
//   • boutons « Faire avancer / reculer » → composant client
//
// Composants client interactifs viendront aux commits 8-9.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const detail = await getProject(ctx.communeId, id);
  if (!detail.project) notFound();
  const p = detail.project;
  const canEdit = ["admin", "editor", "super_admin"].includes(ctx.role ?? "");
  const ecart = computeEcart(p.budget_estime, p.cout_reel);

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Tous les projets
        </Link>
      </div>

      <header className="pj-detail-header">
        <div className="pj-detail-title-block">
          <h1 className="civiq-page-title">{p.titre}</h1>
          <div className="pj-detail-pilotes">
            {p.pilote_elu_profile?.full_name && (
              <span className="civiq-badge civiq-badge-default">
                Élu : {p.pilote_elu_profile.full_name}
              </span>
            )}
            {p.pilote_agent_profile?.full_name && (
              <span className="civiq-badge civiq-badge-default">
                Agent : {p.pilote_agent_profile.full_name}
              </span>
            )}
            <span className="civiq-badge civiq-badge-muted">
              Compétence : {labelCompetence(p.competence)}
            </span>
          </div>
        </div>
        {canEdit && (
          <div className="pj-detail-header-actions">
            <Link href={`/admin/projects/${p.id}/edit`} className="civiq-btn civiq-btn-outline">
              <Edit size={14} /> Modifier
            </Link>
            <a
              href={`/api/projects/${p.id}/pdf`}
              className="civiq-btn civiq-btn-outline"
              target="_blank"
              rel="noreferrer"
            >
              📄 Exporter en PDF
            </a>
          </div>
        )}
      </header>

      {detail.source_ticket && (
        <div className="civiq-card pj-source-ticket">
          <Ticket size={16} />
          <span>
            Projet issu du ticket{" "}
            <Link href={`/admin/tickets/${detail.source_ticket.id}`}>
              #{detail.source_ticket.numero} — {detail.source_ticket.titre}
            </Link>
          </span>
        </div>
      )}

      <ProjectStepper current={p.phase} />

      <div className="pj-detail-grid">
        {/* ── Objectifs ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">Objectifs</h2>
          {p.description && <p className="pj-section-description">{p.description}</p>}
          {p.objectifs ? (
            <p className="pj-section-content">{p.objectifs}</p>
          ) : (
            <p className="pj-section-empty">Pas d&apos;objectifs renseignés.</p>
          )}
        </section>

        {/* ── Synthèse financière ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">Synthèse financière</h2>
          <div className="pj-cost-grid">
            <div className="pj-cost-cell">
              <div className="pj-cost-label">Coût d&apos;investissement</div>
              <div className="pj-cost-value">{formatEuros(p.budget_estime)}</div>
            </div>
            {detail.global_cost && (
              <>
                <div className="pj-cost-cell">
                  <div className="pj-cost-label">Coût global nominal (10 ans)</div>
                  <div className="pj-cost-value">
                    {formatEuros(detail.global_cost.total_nominal)}
                  </div>
                </div>
                <div className="pj-cost-cell pj-cost-cell-highlight">
                  <div className="pj-cost-label">Coût global actualisé</div>
                  <div className="pj-cost-value">
                    {formatEuros(detail.global_cost.total_actualise)}
                  </div>
                  <div className="pj-cost-rates">
                    Inflation {detail.global_cost.taux_inflation_used.toFixed(1)} % ·
                    Actualisation {detail.global_cost.taux_actualisation_used.toFixed(1)} %
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Parties prenantes (RACI) ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Parties prenantes <span className="pj-section-count">({detail.stakeholders.length})</span>
          </h2>
          {detail.stakeholders.length === 0 ? (
            <p className="pj-section-empty">Aucune partie prenante associée.</p>
          ) : (
            <table className="pj-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Rôle</th>
                  <th>Étape</th>
                </tr>
              </thead>
              <tbody>
                {detail.stakeholders.map((ps) => (
                  <tr key={ps.id}>
                    <td>
                      <div className="pj-table-strong">{ps.stakeholder?.nom ?? "—"}</div>
                      {ps.stakeholder?.organisation && (
                        <div className="pj-table-sub">{ps.stakeholder.organisation}</div>
                      )}
                    </td>
                    <td>
                      {ps.stakeholder?.type
                        ? STAKEHOLDER_TYPE_LABELS[ps.stakeholder.type]
                        : "—"}
                    </td>
                    <td>
                      <span className="civiq-badge civiq-badge-default">
                        {STAKEHOLDER_ROLE_LABELS[ps.role]}
                      </span>
                    </td>
                    <td>
                      {ps.phase ? PROJECT_PHASE_LABELS[ps.phase as ProjectPhase] : "Tout le projet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── Plan de financement ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Plan de financement <span className="pj-section-count">({detail.financings.length})</span>
          </h2>
          {detail.financings.length === 0 ? (
            <p className="pj-section-empty">Aucun financement renseigné.</p>
          ) : (
            <>
              <table className="pj-table">
                <thead>
                  <tr>
                    <th>Financeur</th>
                    <th>Demandé</th>
                    <th>Obtenu</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.financings.map((f) => (
                    <tr key={f.id}>
                      <td className="pj-table-strong">{f.financeur}</td>
                      <td>{f.montant_demande ? formatEuros(f.montant_demande) : "—"}</td>
                      <td>{f.montant_obtenu ? formatEuros(f.montant_obtenu) : "—"}</td>
                      <td>
                        <span className={`civiq-badge ${financingBadgeClass(f.statut)}`}>
                          {FINANCING_STATUS_LABELS[f.statut]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="pj-table-strong">Total</td>
                    <td className="pj-table-strong">
                      {formatEuros(detail.financings.reduce((s, f) => s + Number(f.montant_demande ?? 0), 0))}
                    </td>
                    <td className="pj-table-strong">
                      {formatEuros(detail.financings.reduce((s, f) => s + Number(f.montant_obtenu ?? 0), 0))}
                    </td>
                    <td>{p.sans_subvention && <span className="civiq-badge civiq-badge-muted">Autofinancement</span>}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </section>

        {/* ── Coûts 10 ans ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Coûts de fonctionnement &amp; d&apos;entretien sur 10 ans
          </h2>
          {detail.lifecycle.length === 0 ? (
            <p className="pj-section-empty">
              Aucun coût d&apos;exploitation renseigné. <em>Souvent l&apos;élément
              décisif d&apos;un arbitrage d&apos;investissement.</em>
            </p>
          ) : (
            <table className="pj-table">
              <thead>
                <tr>
                  <th>Année</th>
                  <th>Fonctionnement</th>
                  <th>Entretien</th>
                  <th>Total constant</th>
                </tr>
              </thead>
              <tbody>
                {detail.lifecycle.map((l) => (
                  <tr key={l.id}>
                    <td>{l.annee}</td>
                    <td>{formatEuros(l.cout_fonctionnement)}</td>
                    <td>{formatEuros(l.cout_entretien)}</td>
                    <td className="pj-table-strong">
                      {formatEuros(Number(l.cout_fonctionnement) + Number(l.cout_entretien))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── Jalons ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Jalons <span className="pj-section-count">({detail.milestones.length})</span>
          </h2>
          {detail.milestones.length === 0 ? (
            <p className="pj-section-empty">Aucun jalon défini.</p>
          ) : (
            <ul className="pj-milestones">
              {detail.milestones.map((m) => {
                const late = !m.fait && m.echeance && new Date(m.echeance) < new Date();
                return (
                  <li key={m.id} className={`pj-milestone ${m.fait ? "is-done" : ""} ${late ? "is-late" : ""}`}>
                    <input type="checkbox" checked={m.fait} readOnly />
                    <div className="pj-milestone-body">
                      <div className="pj-milestone-label">{m.libelle}</div>
                      <div className="pj-milestone-meta">
                        {PROJECT_PHASE_LABELS[m.phase]}
                        {m.echeance && <> — échéance le {new Date(m.echeance).toLocaleDateString("fr-FR")}</>}
                        {late && <> — <strong>en retard</strong></>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Bilan (visible à partir de realisation) ── */}
        {(p.phase === "realisation" || p.phase === "bilan_cloture") && (
          <section className="civiq-card pj-section">
            <h2 className="pj-section-title">Bilan de réalisation</h2>
            <div className="pj-cost-grid">
              <div className="pj-cost-cell">
                <div className="pj-cost-label">Coût réel</div>
                <div className="pj-cost-value">
                  {p.cout_reel !== null ? formatEuros(p.cout_reel) : "À renseigner"}
                </div>
              </div>
              {ecart && (
                <div
                  className={`pj-cost-cell ${
                    ecart.value > 0 ? "pj-cost-cell-warn" : "pj-cost-cell-success"
                  }`}
                >
                  <div className="pj-cost-label">Écart</div>
                  <div className="pj-cost-value">
                    {ecart.value > 0 ? "+" : ""}
                    {formatEuros(ecart.value)} ({formatPercent(ecart.pct)})
                  </div>
                </div>
              )}
            </div>
            {p.explication_ecart ? (
              <p className="pj-section-content">{p.explication_ecart}</p>
            ) : (
              <p className="pj-section-empty">
                <strong>Bilan obligatoire avant clôture :</strong> renseigner le coût réel et l&apos;explication de l&apos;écart.
              </p>
            )}
          </section>
        )}

        {/* ── Documents ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Documents <span className="pj-section-count">({detail.documents.length})</span>
          </h2>
          {detail.documents.length === 0 ? (
            <p className="pj-section-empty">Aucun document joint.</p>
          ) : (
            <ul className="pj-docs">
              {detail.documents.map((d) => (
                <li key={d.id}>
                  <a href={d.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={12} /> {d.nom}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Abonnés ── */}
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Abonnés aux notifications <span className="pj-section-count">({detail.subscribers.length})</span>
          </h2>
          {detail.subscribers.length === 0 ? (
            <p className="pj-section-empty">Aucun abonné.</p>
          ) : (
            <ul className="pj-subs">
              {detail.subscribers.map((s) => (
                <li key={s.id}>{s.profile?.full_name ?? "—"}</li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Historique des transitions ── */}
        <section className="civiq-card pj-section pj-history">
          <h2 className="pj-section-title">Historique des transitions</h2>
          {detail.phase_log.length === 0 ? (
            <p className="pj-section-empty">Aucune transition enregistrée.</p>
          ) : (
            <ol className="pj-history-list">
              {detail.phase_log.map((l) => (
                <li key={l.id}>
                  <div className="pj-history-when">
                    {new Date(l.created_at).toLocaleString("fr-FR")}
                  </div>
                  <div className="pj-history-what">
                    {l.from_phase ? PROJECT_PHASE_LABELS[l.from_phase] : "—"}{" → "}
                    <strong>{PROJECT_PHASE_LABELS[l.to_phase]}</strong>
                    {l.forced && <span className="civiq-badge civiq-badge-warning"> Forcé</span>}
                  </div>
                  {l.commentaire && (
                    <div className="pj-history-comment">{l.commentaire}</div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

function labelCompetence(c: string): string {
  switch (c) {
    case "communale": return "Communale";
    case "intercommunale": return "Intercommunale";
    case "a_verifier": return "À vérifier";
    default: return c;
  }
}

function financingBadgeClass(statut: string): string {
  switch (statut) {
    case "accordee":
    case "soldee":
      return "civiq-badge-success";
    case "refusee":
      return "civiq-badge-warning";
    case "ar_recu":
      return "civiq-badge-success";
    default:
      return "civiq-badge-muted";
  }
}
