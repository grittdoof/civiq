import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { filtrerProjetsVisibles } from "@/lib/projects/confidentialite";
import TypeBadge from "@/components/projects/TypeBadge";
import {
  PROJECT_PHASE_LABELS,
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_TYPE_LABELS,
  type ProjectPhase,
  type StakeholderRole,
  type StakeholderType,
  type TypeProjetCode,
} from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/cartographie — vue transversale « qui intervient
// sur quoi », filtrable par type et rôle. Réunit les parties prenantes
// d'un projet (rôle RACI) et celles rattachées à une étape (lot B).
// Projets confidentiels filtrés (même règle que user_voit_projet).
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
  const projetSel = "id, titre, type_code, commune_id, confidentiel, pilote_elu, pilote_agent";
  const [{ data }, { data: etapesData }] = await Promise.all([
    service
      .from("project_stakeholders")
      .select(`
        id, role, phase,
        stakeholder:contacts!inner ( id, nom, organisation, type:categorie, commune_id ),
        project:projects!inner ( ${projetSel} )
      `)
      .eq("project.commune_id", ctx.communeId)
      .eq("stakeholder.commune_id", ctx.communeId)
      .is("project.deleted_at", null)
      .is("project.archived_at", null)
      .is("stakeholder.deleted_at", null),
    service
      .from("milestone_contacts")
      .select(`
        id,
        stakeholder:contacts!inner ( id, nom, organisation, type:categorie, commune_id ),
        milestone:milestones!inner ( id, libelle, deleted_at, project:projects!inner ( ${projetSel} ) )
      `)
      .eq("stakeholder.commune_id", ctx.communeId)
      .eq("milestone.project.commune_id", ctx.communeId)
      .is("milestone.deleted_at", null)
      .is("milestone.project.deleted_at", null)
      .is("milestone.project.archived_at", null)
      .is("stakeholder.deleted_at", null),
  ]);

  type Projet = { id: string; titre: string; type_code: TypeProjetCode | null; commune_id: string; confidentiel: boolean; pilote_elu: string | null; pilote_agent: string | null };
  type Contact = { id: string; nom: string; organisation: string | null; type: StakeholderType; commune_id: string };
  type Row = {
    id: string;
    role: StakeholderRole | null;
    phase: ProjectPhase | null;
    etape: string | null;
    stakeholder: Contact | null;
    project: Projet | null;
  };

  const projetRows: Row[] = ((data ?? []) as unknown as Array<Omit<Row, "etape">>).map((r) => ({ ...r, etape: null }));
  const etapeRows: Row[] = ((etapesData ?? []) as unknown as Array<{ id: string; stakeholder: Contact | null; milestone: { libelle: string; project: Projet | null } | null }>)
    .map((r) => ({ id: `e-${r.id}`, role: null, phase: null, etape: r.milestone?.libelle ?? null, stakeholder: r.stakeholder, project: r.milestone?.project ?? null }));
  const tous = [...projetRows, ...etapeRows].filter(
    (r) => r.stakeholder?.commune_id === ctx.communeId && r.project?.commune_id === ctx.communeId,
  );
  const visibles = new Set(
    (await filtrerProjetsVisibles(service, { id: ctx.userId, role: ctx.role }, [...new Map(tous.map((r) => [r.project!.id, r.project!])).values()])).map((p) => p.id),
  );
  let rows = tous.filter((r) => visibles.has(r.project!.id));

  if (type) rows = rows.filter((r) => r.stakeholder?.type === type);
  if (role) rows = rows.filter((r) => r.role === role);
  rows.sort((a, b) => a.project!.titre.localeCompare(b.project!.titre, "fr"));

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
        Qui intervient sur quel projet : rôle sur l&apos;ensemble du projet (responsable, approbateur, consulté, informé)
        ou participation à une étape précise.
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
                    <th scope="col">Projet</th>
                    <th scope="col">Type</th>
                    <th scope="col">Rôle</th>
                    <th scope="col">Intervient sur</th>
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
                      <td><TypeBadge type={l.project!.type_code ?? "suivi_simple"} size="sm" /></td>
                      <td>
                        {l.role ? (
                          <span className="civiq-badge civiq-badge-default">{STAKEHOLDER_ROLE_LABELS[l.role]}</span>
                        ) : (
                          <span className="pj-list-muted">Participant</span>
                        )}
                      </td>
                      <td>{l.etape ? `Étape : ${l.etape}` : l.phase ? PROJECT_PHASE_LABELS[l.phase] : "Tout le projet"}</td>
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
