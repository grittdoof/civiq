import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import "../../projects/projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getCommission } from "@/lib/projects/queries";
import CommissionMembersEditor from "@/components/projects/CommissionMembersEditor";
import CommissionProjectsEditor from "@/components/projects/CommissionProjectsEditor";
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
  const [{ data: profilesDir }, { data: projectsDir }] = await Promise.all([
    service.from("profiles").select("id, full_name, job_title").eq("commune_id", ctx.communeId),
    service.from("projects").select("id, titre, phase").eq("commune_id", ctx.communeId).order("titre"),
  ]);

  const canEdit = ["admin", "super_admin"].includes(ctx.role ?? "");
  const canCreateSession = ["admin", "editor", "super_admin"].includes(ctx.role ?? "");

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href="/admin/commissions" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Commissions
        </Link>
      </div>

      <header className="pj-detail-header">
        <div>
          <h1 className="civiq-page-title">{detail.commission.nom}</h1>
          {detail.commission.description && (
            <p className="pj-page-subtitle">{detail.commission.description}</p>
          )}
        </div>
        {canCreateSession && (
          <div className="pj-page-header-actions">
            <Link
              href={`/admin/commissions/${id}/sessions/nouvelle`}
              className="civiq-btn civiq-btn-default"
            >
              <CalendarPlus size={14} /> Nouvelle séance
            </Link>
          </div>
        )}
      </header>

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
            <ul className="pj-subs">
              {detail.upcoming_sessions.map((s) => (
                <li key={s.id} className="pj-sub-row">
                  <span>
                    <Link href={`/admin/commissions/${id}/sessions/${s.id}`} className="pj-table-strong">
                      {new Date(s.date_seance).toLocaleString("fr-FR", {
                        weekday: "long", day: "numeric", month: "long",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </Link>
                    {s.lieu && <span className="pj-table-sub"> — {s.lieu}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="civiq-card pj-section pj-section-wide">
          <h2 className="pj-section-title">Séances passées</h2>
          {detail.past_sessions.length === 0 ? (
            <p className="pj-section-empty">Aucune séance passée.</p>
          ) : (
            <ul className="pj-subs">
              {detail.past_sessions.map((s) => (
                <li key={s.id} className="pj-sub-row">
                  <span>
                    <Link href={`/admin/commissions/${id}/sessions/${s.id}`} className="pj-table-strong">
                      {new Date(s.date_seance).toLocaleDateString("fr-FR")}
                    </Link>
                    {s.compte_rendu_valide && (
                      <span className="civiq-badge civiq-badge-success" style={{ marginLeft: 6 }}>
                        CR validé
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
