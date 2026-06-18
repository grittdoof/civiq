import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import {
  PROJECT_PHASE_LABELS,
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_TYPE_LABELS,
  type ProjectPhase,
  type StakeholderRole,
  type StakeholderType,
} from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/cartographie — vue transversale « qui intervient
// sur quoi », filtrable par type et rôle.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ type?: string; role?: string }>;
}

export default async function CartographiePage({ searchParams }: Props) {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const { type, role } = await searchParams;

  const service = await createServiceClient();
  const { data } = await service
    .from("project_stakeholders")
    .select(`
      id, role, phase,
      stakeholder:stakeholders ( id, nom, organisation, type, commune_id ),
      project:projects ( id, titre, phase, commune_id )
    `);

  type Row = {
    id: string;
    role: StakeholderRole;
    phase: ProjectPhase | null;
    stakeholder: { id: string; nom: string; organisation: string | null; type: StakeholderType; commune_id: string } | null;
    project: { id: string; titre: string; phase: ProjectPhase; commune_id: string } | null;
  };

  let rows = ((data ?? []) as unknown as Row[]).filter(
    (r) => r.stakeholder?.commune_id === ctx.communeId && r.project?.commune_id === ctx.communeId,
  );

  if (type) rows = rows.filter((r) => r.stakeholder?.type === type);
  if (role) rows = rows.filter((r) => r.role === role);

  // Regrouper par stakeholder
  const byStakeholder = new Map<string, { nom: string; type: StakeholderType; lines: Row[] }>();
  for (const r of rows) {
    if (!r.stakeholder) continue;
    const key = r.stakeholder.id;
    if (!byStakeholder.has(key)) {
      byStakeholder.set(key, {
        nom: r.stakeholder.nom + (r.stakeholder.organisation ? ` (${r.stakeholder.organisation})` : ""),
        type: r.stakeholder.type,
        lines: [],
      });
    }
    byStakeholder.get(key)!.lines.push(r);
  }

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Tous les projets
        </Link>
      </div>

      <h1 className="civiq-page-title">Cartographie des parties prenantes</h1>
      <p className="pj-page-subtitle">
        Vue transversale : qui intervient sur quel projet, dans quel rôle RACI
        et à quelle étape.
      </p>

      <div className="pj-filters">
        <FilterLink label="Tous" href="/admin/projects/cartographie" active={!type && !role} />
        <span className="pj-filters-sep">Type :</span>
        {(Object.keys(STAKEHOLDER_TYPE_LABELS) as StakeholderType[]).map((t) => (
          <FilterLink
            key={t}
            label={STAKEHOLDER_TYPE_LABELS[t]}
            href={`/admin/projects/cartographie?type=${t}${role ? `&role=${role}` : ""}`}
            active={type === t}
          />
        ))}
        <span className="pj-filters-sep">Rôle :</span>
        {(Object.keys(STAKEHOLDER_ROLE_LABELS) as StakeholderRole[]).map((r) => (
          <FilterLink
            key={r}
            label={STAKEHOLDER_ROLE_LABELS[r]}
            href={`/admin/projects/cartographie?role=${r}${type ? `&type=${type}` : ""}`}
            active={role === r}
          />
        ))}
      </div>

      {byStakeholder.size === 0 ? (
        <div className="civiq-card pj-empty">
          <p className="pj-empty-title">Aucune association de parties prenantes</p>
        </div>
      ) : (
        <div className="pj-cartographie">
          {[...byStakeholder.values()].map((s, i) => (
            <div key={i} className="civiq-card pj-section">
              <h3 className="pj-section-title">
                {s.nom}
                <span className="civiq-badge civiq-badge-muted">
                  {STAKEHOLDER_TYPE_LABELS[s.type]}
                </span>
              </h3>
              <table className="pj-table">
                <thead>
                  <tr>
                    <th>Projet</th>
                    <th>Étape du projet</th>
                    <th>Rôle</th>
                    <th>Étape d&apos;intervention</th>
                  </tr>
                </thead>
                <tbody>
                  {s.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/admin/projects/${l.project!.id}`} className="pj-table-strong">
                          {l.project!.titre}
                        </Link>
                      </td>
                      <td>{PROJECT_PHASE_LABELS[l.project!.phase]}</td>
                      <td>
                        <span className="civiq-badge civiq-badge-default">
                          {STAKEHOLDER_ROLE_LABELS[l.role]}
                        </span>
                      </td>
                      <td>{l.phase ? PROJECT_PHASE_LABELS[l.phase] : "Tout le projet"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`pj-filter-link ${active ? "is-active" : ""}`}
      prefetch={false}
    >
      {label}
    </Link>
  );
}
