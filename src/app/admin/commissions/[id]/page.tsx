import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { extractExcerpt } from "@/lib/projects/text-utils";
import "../../projects/projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getCommission } from "@/lib/projects/queries";
import CommissionMembersEditor from "@/components/projects/CommissionMembersEditor";
import CommissionProjectsEditor from "@/components/projects/CommissionProjectsEditor";
import CommissionAdminActions from "@/components/projects/CommissionAdminActions";
import CommissionIcon from "@/components/projects/CommissionIcon";
import NewCommissionDialog from "@/components/projects/NewCommissionDialog";
import type { ProjectPhase } from "@/lib/projects/types";

export const dynamic = "force-dynamic";

interface PageProps { params: Promise<{ id: string }>; }

export default async function CommissionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const detail = await getCommission(ctx.communeId, id);
  if (!detail.commission) notFound();

  const service = await createServiceClient();
  const [
    { data: profilesDir },
    { data: projectsDir },
    { data: subCommissions },
    { data: parentRow },
  ] = await Promise.all([
    service.from("profiles").select("id, full_name, job_title").eq("commune_id", ctx.communeId),
    service.from("projects").select("id, titre, phase").eq("commune_id", ctx.communeId).order("titre"),
    service
      .from("commissions")
      .select("id, nom, color, icon, active")
      .eq("parent_id", id)
      .order("nom"),
    detail.commission.parent_id
      ? service
          .from("commissions")
          .select("id, nom, color, icon")
          .eq("id", detail.commission.parent_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const subs = (subCommissions ?? []) as Array<{
    id: string; nom: string; color: string; icon: string; active: boolean;
  }>;
  const parent = parentRow as { id: string; nom: string; color: string; icon: string } | null;
  const isRoot = !detail.commission.parent_id;

  // Édition étendue aux éditeurs : un élu/agent peut piloter
  // sa commission (membres, projets rattachés, séances).
  const canEdit = ["admin", "editor", "super_admin"].includes(ctx.role ?? "");
  const canCreateSession = canEdit;
  // Modifier les attributs de la commission (nom, couleur, etc.) :
  // ouvert aux éditeurs.
  const canEditCommission = canEdit;
  // Suppression : admin commune ou super_admin
  const canDeleteCommission = ["admin", "super_admin"].includes(ctx.role ?? "");

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href="/admin/commissions" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Commissions
        </Link>
      </div>

      <header className="pj-detail-header">
        <div>
          {/* Lien retour vers la commission parente si on est une sous-commission */}
          {parent && (
            <div style={{ marginBottom: 6 }}>
              <Link
                href={`/admin/commissions/${parent.id}`}
                className="pj-commission-badge"
                style={{ ['--comm-color' as string]: parent.color }}
              >
                <CommissionIcon name={parent.icon} size={11} />
                <span>Sous-commission de {parent.nom}</span>
              </Link>
            </div>
          )}
          <h1 className="civiq-page-title">{detail.commission.nom}</h1>
          {detail.commission.description && (
            <p className="pj-page-subtitle">{detail.commission.description}</p>
          )}
        </div>
        <div className="pj-page-header-actions">
          {(canEditCommission || canDeleteCommission) && (
            <CommissionAdminActions
              commissionId={id}
              initial={{
                nom: detail.commission.nom,
                description: detail.commission.description,
                responsable_user_id: detail.commission.responsable_user_id,
                color: detail.commission.color,
                icon: detail.commission.icon,
                active: detail.commission.active,
              }}
              profiles={(profilesDir ?? []) as { id: string; full_name: string | null }[]}
              canEdit={canEditCommission}
              canDelete={canDeleteCommission}
            />
          )}
          {/* Création de sous-commission uniquement depuis une commission racine */}
          {canCreateSession && isRoot && (
            <NewCommissionDialog
              profiles={(profilesDir ?? []) as { id: string; full_name: string | null; job_title: string | null }[]}
              possibleParents={[{
                id: detail.commission.id,
                nom: detail.commission.nom,
                color: detail.commission.color,
                icon: detail.commission.icon,
              }]}
              presetParentId={detail.commission.id}
              buttonLabel="Nouvelle sous-commission"
            />
          )}
          {canCreateSession && (
            <Link
              href={`/admin/commissions/${id}/sessions/nouvelle`}
              className="civiq-btn civiq-btn-default"
            >
              <CalendarPlus size={14} /> Nouvelle séance
            </Link>
          )}
        </div>
      </header>

      {/* Sous-commissions de cette commission */}
      {subs.length > 0 && (
        <section className="civiq-card pj-section pj-section-wide">
          <h2 className="pj-section-title">
            Sous-commissions
            <span className="pj-section-count">({subs.length})</span>
          </h2>
          <div className="pj-detail-pilotes">
            {subs.map((sub) => (
              <Link
                key={sub.id}
                href={`/admin/commissions/${sub.id}`}
                className="pj-commission-badge"
                style={{ ['--comm-color' as string]: sub.color }}
              >
                <CommissionIcon name={sub.icon} size={11} />
                <span>{sub.nom}</span>
                {!sub.active && <span style={{ fontSize: 10, opacity: 0.7 }}>(inactive)</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="pj-detail-grid">
        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Membres <span className="pj-section-count">({detail.members.length})</span>
          </h2>
          <CommissionMembersEditor
            commissionId={id}
            initial={detail.members}
            directory={(profilesDir ?? []) as { id: string; full_name: string | null; job_title: string | null }[]}
            canEdit={canEdit}
          />
        </section>

        <section className="civiq-card pj-section">
          <h2 className="pj-section-title">
            Projets suivis <span className="pj-section-count">({detail.projects.length})</span>
          </h2>
          <CommissionProjectsEditor
            commissionId={id}
            initial={detail.projects.map((p) => ({
              id: p.id,
              project_id: p.project_id,
              project: p.project ? { id: p.project.id, titre: p.project.titre, phase: p.project.phase as ProjectPhase } : null,
            }))}
            directory={(projectsDir ?? []) as { id: string; titre: string; phase: ProjectPhase }[]}
            canEdit={canCreateSession}
          />
        </section>

        <section className="civiq-card pj-section pj-section-wide">
          <h2 className="pj-section-title">Prochaines séances</h2>
          {detail.upcoming_sessions.length === 0 ? (
            <p className="pj-section-empty">Aucune séance planifiée.</p>
          ) : (
            <ul className="pj-sessions-list">
              {detail.upcoming_sessions.map((s) => {
                const excerpt = extractExcerpt(s.ordre_du_jour, 90);
                return (
                  <li key={s.id} className="pj-session-row">
                    <Link href={`/admin/commissions/${id}/sessions/${s.id}`} className="pj-session-link">
                      <div className="pj-session-date">
                        {new Date(s.date_seance).toLocaleString("fr-FR", {
                          weekday: "long", day: "numeric", month: "long",
                          hour: "2-digit", minute: "2-digit",
                        })}
                        {s.lieu && <span className="pj-table-sub"> — {s.lieu}</span>}
                      </div>
                      {excerpt && (
                        <div className="pj-session-excerpt" title={excerpt}>
                          {excerpt}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="civiq-card pj-section pj-section-wide">
          <h2 className="pj-section-title">Séances passées</h2>
          {detail.past_sessions.length === 0 ? (
            <p className="pj-section-empty">Aucune séance passée.</p>
          ) : (
            <ul className="pj-sessions-list">
              {detail.past_sessions.map((s) => {
                const excerpt = extractExcerpt(s.ordre_du_jour, 90);
                return (
                  <li key={s.id} className="pj-session-row">
                    <Link href={`/admin/commissions/${id}/sessions/${s.id}`} className="pj-session-link">
                      <div className="pj-session-date">
                        {new Date(s.date_seance).toLocaleDateString("fr-FR", {
                          weekday: "long", day: "numeric", month: "long", year: "numeric",
                        })}
                        {s.compte_rendu_valide && (
                          <span className="civiq-badge civiq-badge-success" style={{ marginLeft: 6 }}>
                            CR validé
                          </span>
                        )}
                      </div>
                      {excerpt && (
                        <div className="pj-session-excerpt" title={excerpt}>
                          {excerpt}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
