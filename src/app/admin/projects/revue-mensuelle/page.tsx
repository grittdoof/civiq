import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listProjects } from "@/lib/projects/queries";
import { PROJECT_PHASE_LABELS, SECURED_FINANCING_STATUSES } from "@/lib/projects/types";
import PrintButton from "@/components/projects/PrintButton";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/revue-mensuelle — synthèse exportable :
// tous les projets, leur étape, alertes et prochaines échéances.
// Imprimable directement (CSS @media print).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function RevueMensuellePage() {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const projects = await listProjects(ctx.communeId);
  const service = await createServiceClient();
  const { data: commune } = await service
    .from("communes")
    .select("name")
    .eq("id", ctx.communeId)
    .maybeSingle();

  // Pour chaque projet : prochains jalons + statuts financements
  const ids = projects.map((p) => p.id);
  const [{ data: nextMilestones }, { data: finStatuses }] = await Promise.all([
    ids.length
      ? service
          .from("milestones")
          .select("project_id, libelle, echeance, fait")
          .in("project_id", ids)
          .eq("fait", false)
          .order("echeance", { nullsFirst: false })
      : Promise.resolve({ data: [] }),
    ids.length
      ? service
          .from("financings")
          .select("project_id, statut, financeur")
          .in("project_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const milestonesByProj = new Map<string, { libelle: string; echeance: string | null; late: boolean }[]>();
  const now = new Date();
  for (const m of nextMilestones ?? []) {
    const arr = milestonesByProj.get(m.project_id) ?? [];
    arr.push({
      libelle: m.libelle,
      echeance: m.echeance,
      late: !!m.echeance && new Date(m.echeance) < now,
    });
    milestonesByProj.set(m.project_id, arr);
  }

  const financingsByProj = new Map<string, { statut: string; financeur: string }[]>();
  for (const f of finStatuses ?? []) {
    const arr = financingsByProj.get(f.project_id) ?? [];
    arr.push({ statut: f.statut, financeur: f.financeur });
    financingsByProj.set(f.project_id, arr);
  }

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <main className="civiq-main pj-detail-page pj-print">
      <div className="pj-detail-back civiq-no-print">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Tous les projets
        </Link>
        <PrintButton />
      </div>

      <h1 className="civiq-page-title">
        Revue mensuelle — {commune?.name ?? "Commune"}
      </h1>
      <p className="pj-page-subtitle">Édité le {today}</p>

      {projects.length === 0 ? (
        <div className="civiq-card pj-empty">
          <p className="pj-empty-title">Aucun projet en cours.</p>
        </div>
      ) : (
        <section className="civiq-card pj-section pj-section-wide">
          <table className="pj-table">
            <thead>
              <tr>
                <th>Projet</th>
                <th>Étape</th>
                <th>Pilotes</th>
                <th>Alertes</th>
                <th>Prochaines échéances</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const ms = milestonesByProj.get(p.id) ?? [];
                const lateMs = ms.filter((m) => m.late);
                const nextMs = ms.filter((m) => !m.late).slice(0, 2);
                const fs = financingsByProj.get(p.id) ?? [];
                const hasSecured = p.sans_subvention || fs.some((f) =>
                  (SECURED_FINANCING_STATUSES as string[]).includes(f.statut),
                );
                const alerts: string[] = [];
                if (lateMs.length > 0) alerts.push(`${lateMs.length} jalon(s) en retard`);
                if (!hasSecured && (p.phase === "financement" || p.phase === "conception_marches")) {
                  alerts.push("Subvention non sécurisée");
                }
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/projects/${p.id}`} className="pj-table-strong">
                        {p.titre}
                      </Link>
                    </td>
                    <td>{PROJECT_PHASE_LABELS[p.phase]}</td>
                    <td className="pj-table-sub">
                      {[p.pilote_elu_profile?.full_name, p.pilote_agent_profile?.full_name]
                        .filter(Boolean)
                        .join(" / ") || "—"}
                    </td>
                    <td>
                      {alerts.length === 0 ? (
                        <span className="pj-table-sub">—</span>
                      ) : (
                        alerts.map((a, i) => (
                          <span key={i} className="civiq-badge civiq-badge-warning" style={{ marginRight: 4 }}>
                            {a}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="pj-table-sub">
                      {nextMs.length === 0
                        ? "—"
                        : nextMs.map((m) => (
                            <div key={m.libelle}>
                              {m.libelle}
                              {m.echeance && <> — {new Date(m.echeance).toLocaleDateString("fr-FR")}</>}
                            </div>
                          ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
