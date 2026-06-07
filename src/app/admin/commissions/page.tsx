import { redirect } from "next/navigation";
import Link from "next/link";
import { Gavel, Users as UsersIcon } from "lucide-react";
import CommissionIcon from "@/components/projects/CommissionIcon";
import "../projects/projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listCommissions } from "@/lib/projects/queries";
import NewCommissionDialog from "@/components/projects/NewCommissionDialog";

export const dynamic = "force-dynamic";

export default async function CommissionsListPage() {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const commissions = await listCommissions(ctx.communeId);
  const service = await createServiceClient();
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("commune_id", ctx.communeId);

  const isAdmin = ["admin", "super_admin"].includes(ctx.role ?? "");

  // Compteurs (membres et projets rattachés) par commission
  const ids = commissions.map((c) => c.id);
  const [{ data: members }, { data: cprojects }, { data: nextSessions }] = await Promise.all([
    ids.length ? service.from("commission_members").select("commission_id").in("commission_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? service.from("commission_projects").select("commission_id").in("commission_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? service
          .from("commission_sessions")
          .select("commission_id, date_seance")
          .in("commission_id", ids)
          .gte("date_seance", new Date().toISOString())
          .order("date_seance")
      : Promise.resolve({ data: [] }),
  ]);

  const counts = new Map<string, { members: number; projects: number; nextSession: string | null }>();
  for (const c of commissions) counts.set(c.id, { members: 0, projects: 0, nextSession: null });
  for (const m of members ?? []) counts.get(m.commission_id)!.members += 1;
  for (const p of cprojects ?? []) counts.get(p.commission_id)!.projects += 1;
  for (const s of nextSessions ?? []) {
    const c = counts.get(s.commission_id)!;
    if (!c.nextSession) c.nextSession = s.date_seance;
  }

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-page-header">
        <div>
          <h1 className="civiq-page-title">Commissions municipales</h1>
          <p className="pj-page-subtitle">
            Pilotez les commissions, leurs membres, les projets qu&apos;elles suivent
            et leurs séances de travail.
          </p>
        </div>
        {isAdmin && (
          <div className="pj-page-header-actions">
            <NewCommissionDialog
              profiles={(profiles ?? []) as { id: string; full_name: string | null }[]}
            />
          </div>
        )}
      </div>

      {commissions.length === 0 ? (
        <div className="civiq-card pj-empty">
          <div className="pj-empty-icon" aria-hidden><Gavel size={36} /></div>
          <p className="pj-empty-title">Aucune commission</p>
          <p className="pj-empty-hint">
            Créez vos commissions Finances, Travaux, Urbanisme, etc.
          </p>
        </div>
      ) : (
        <div className="pj-commissions-grid">
          {commissions.map((c) => {
            const k = counts.get(c.id)!;
            return (
              <Link
                key={c.id}
                href={`/admin/commissions/${c.id}`}
                className="civiq-card pj-section"
                prefetch={false}
                style={{ display: "block", textDecoration: "none", color: "inherit" }}
              >
                <h3 className="pj-section-title" style={{ marginBottom: 4 }}>
                  <span
                    style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: c.color, color: "#fff",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    <CommissionIcon name={c.icon} size={15} color="#fff" />
                  </span>
                  {c.nom}
                  {!c.active && <span className="civiq-badge civiq-badge-muted">Inactive</span>}
                </h3>
                {c.description && <p className="pj-section-description">{c.description}</p>}
                <div className="pj-detail-pilotes">
                  <span className="civiq-badge civiq-badge-muted">
                    <UsersIcon size={11} /> {k.members} membres
                  </span>
                  <span className="civiq-badge civiq-badge-muted">
                    {k.projects} projets suivis
                  </span>
                  {k.nextSession && (
                    <span className="civiq-badge civiq-badge-default">
                      Prochaine séance le {new Date(k.nextSession).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
