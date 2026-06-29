import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, FileDown, PencilLine } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { getProject } from "@/lib/projects/queries";
import { formatEuros } from "@/lib/projects/cost-calc";
import {
  FINANCING_STATUS_LABELS,
  PROJECT_PHASE_LABELS,
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_TYPE_LABELS,
  type ProjectPhase,
} from "@/lib/projects/types";
import "../../projects.css";
import "../../flow.css";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/[id]/fiche — synthèse read-only.
// La saisie reste dans les phases/livrables ; cette page sert à
// relire, imprimer et exporter.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const EDIT_LINKS: Record<string, { phase: ProjectPhase; deliv: number; label: string }> = {
  identity: { phase: "emergence", deliv: 0, label: "Modifier l'identité" },
  documents: { phase: "emergence", deliv: 1, label: "Ajouter un document" },
  pilotes: { phase: "emergence", deliv: 2, label: "Modifier les pilotes" },
  stakeholders: { phase: "emergence", deliv: 3, label: "Associer une partie prenante" },
  lifecycle: { phase: "faisabilite", deliv: 1, label: "Modifier le cadrage financier" },
  financings: { phase: "faisabilite", deliv: 2, label: "Ajouter un financement" },
  milestones: { phase: "decision_budget", deliv: 2, label: "Ajouter un jalon" },
  bilan: { phase: "bilan_cloture", deliv: 0, label: "Compléter le bilan" },
};

export default async function ProjectFichePage({ params }: Props) {
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

  const totalDemande = detail.financings.reduce((sum, f) => sum + Number(f.montant_demande ?? 0), 0);
  const totalObtenu = detail.financings.reduce((sum, f) => sum + Number(f.montant_obtenu ?? 0), 0);
  const currentPhaseHref = `/admin/projects/${id}/phase/${p.phase}`;

  return (
    <main className="civiq-main pj-flow-page pj-summary-page">
      <div className="pj-flow-topbar">
        <div className="pj-flow-topbar-title">
          <Link
            href={currentPhaseHref}
            className="pj-flow-back-pill"
            title="Retour aux phases"
            prefetch={false}
          >
            <ArrowLeft size={14} />
          </Link>
          <h1 className="pj-flow-project-title">{p.titre}</h1>
        </div>
        <a
          href={`/projects-pdf?kind=project&id=${p.id}`}
          className="civiq-btn civiq-btn-outline civiq-btn-sm"
          target="_blank"
          rel="noreferrer"
        >
          <FileDown size={13} /> PDF
        </a>
      </div>

      <header className="pj-summary-hero">
        <span className="pj-summary-kicker">Fiche projet</span>
        <h2>{p.titre}</h2>
        <p>{p.description ?? "Aucune description courte renseignée."}</p>
        <div className="pj-summary-meta">
          <span>{PROJECT_PHASE_LABELS[p.phase]}</span>
          <span>{formatEuros(p.budget_estime)}</span>
          <span>{detail.documents.length} document{detail.documents.length > 1 ? "s" : ""}</span>
        </div>
      </header>

      <div className="pj-summary-stack">
        <SummarySection title="Identité" edit={editHref(p.id, "identity")}>
          <SummaryGrid
            rows={[
              ["Objectifs", p.objectifs ?? "Non renseignés"],
              ["Compétence", labelCompetence(p.competence)],
              ["Ticket source", detail.source_ticket ? `#${detail.source_ticket.numero} — ${detail.source_ticket.titre}` : "Aucun"],
            ]}
          />
        </SummarySection>

        <SummarySection title="Pilotes" edit={editHref(p.id, "pilotes")}>
          <SummaryGrid
            rows={[
              ["Pilote élu", p.pilote_elu_profile?.full_name ?? "Non désigné"],
              ["Pilote agent", p.pilote_agent_profile?.full_name ?? "Non désigné"],
            ]}
          />
        </SummarySection>

        <SummarySection title="Parties prenantes" edit={editHref(p.id, "stakeholders")}>
          {detail.stakeholders.length === 0 ? (
            <p className="pj-summary-empty">Aucune partie prenante associée.</p>
          ) : (
            <div className="pj-summary-list">
              {detail.stakeholders.map((ps) => (
                <div key={ps.id} className="pj-summary-row-card">
                  <strong>{ps.stakeholder?.nom ?? "Contact supprimé"}</strong>
                  <span>
                    {ps.stakeholder?.type ? STAKEHOLDER_TYPE_LABELS[ps.stakeholder.type] : "Type inconnu"}
                    {" · "}
                    {STAKEHOLDER_ROLE_LABELS[ps.role]}
                    {ps.phase ? ` · ${PROJECT_PHASE_LABELS[ps.phase]}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SummarySection>

        <SummarySection title="Financement" edit={editHref(p.id, "financings")}>
          <SummaryGrid
            rows={[
              ["Budget estimé", formatEuros(p.budget_estime)],
              ["Demandé", formatEuros(totalDemande)],
              ["Obtenu", formatEuros(totalObtenu)],
              ["Reste à charge", formatEuros(Math.max(p.budget_estime - totalObtenu, 0))],
            ]}
          />
          {detail.financings.length > 0 && (
            <div className="pj-summary-list">
              {detail.financings.map((f) => (
                <div key={f.id} className="pj-summary-row-card">
                  <strong>{f.financeur}</strong>
                  <span>
                    {f.dispositif ?? "Sans dispositif"} · {FINANCING_STATUS_LABELS[f.statut]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SummarySection>

        <SummarySection title="Jalons" edit={editHref(p.id, "milestones")}>
          {detail.milestones.length === 0 ? (
            <p className="pj-summary-empty">Aucun jalon défini.</p>
          ) : (
            <div className="pj-summary-list">
              {detail.milestones.map((m) => (
                <div key={m.id} className="pj-summary-row-card">
                  <strong>{m.libelle}</strong>
                  <span>
                    {PROJECT_PHASE_LABELS[m.phase]} · {m.echeance ? formatDate(m.echeance) : "Sans échéance"} · {m.fait ? "Fait" : "À faire"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SummarySection>

        <SummarySection title="Coût global" edit={editHref(p.id, "lifecycle")}>
          <SummaryGrid
            rows={[
              ["Investissement", formatEuros(detail.global_cost?.invest ?? p.budget_estime)],
              ["Total nominal", formatEuros(detail.global_cost?.total_nominal ?? p.budget_estime)],
              ["Total actualisé", formatEuros(detail.global_cost?.total_actualise ?? p.budget_estime)],
            ]}
          />
        </SummarySection>

        <SummarySection title="Documents" edit={editHref(p.id, "documents")}>
          {detail.documents.length === 0 ? (
            <p className="pj-summary-empty">Aucun document attaché.</p>
          ) : (
            <div className="pj-summary-list">
              {detail.documents.map((doc) => (
                <a key={doc.id} href={doc.url} className="pj-summary-row-card" target="_blank" rel="noreferrer">
                  <strong>{doc.nom}</strong>
                  <span>{doc.type} · {formatDate(doc.uploaded_at)}</span>
                </a>
              ))}
            </div>
          )}
        </SummarySection>

        <SummarySection title="Bilan" edit={editHref(p.id, "bilan")}>
          <SummaryGrid
            rows={[
              ["Coût réel", p.cout_reel !== null ? formatEuros(p.cout_reel) : "Non renseigné"],
              ["Écart", p.ecart !== null ? formatEuros(p.ecart) : "Non calculé"],
              ["Explication", p.explication_ecart ?? "Non renseignée"],
            ]}
          />
        </SummarySection>
      </div>
    </main>
  );
}

function SummarySection({
  title,
  edit,
  children,
}: {
  title: string;
  edit: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="pj-summary-section">
      <div className="pj-summary-section-head">
        <h3>{title}</h3>
        <Link href={edit.href} className="pj-summary-edit" prefetch={false}>
          <PencilLine size={13} />
          {edit.label}
        </Link>
      </div>
      {children}
    </section>
  );
}

function SummaryGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="pj-summary-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function editHref(projectId: string, key: keyof typeof EDIT_LINKS) {
  const target = EDIT_LINKS[key];
  return {
    href: `/admin/projects/${projectId}/phase/${target.phase}/${target.deliv}`,
    label: target.label,
  };
}

function labelCompetence(value: string) {
  if (value === "communale") return "Communale";
  if (value === "intercommunale") return "Intercommunale";
  if (value === "a_verifier") return "À vérifier";
  return value;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}
