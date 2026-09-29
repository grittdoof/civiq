import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { chargerPortefeuille } from "@/lib/projects/portefeuille-server";
import { avancementAffiche, isEnRetard, statutOf } from "@/lib/projects/etapes";
import { dateReporting, type EtapePilotage } from "@/lib/projects/pilotage";
import TypeBadge from "@/components/projects/TypeBadge";
import PrintButton from "@/components/projects/PrintButton";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/revue-mensuelle — tableau de bord imprimable pour la
// réunion mensuelle (maire, adjoints) : par commission, chaque projet
// avec son avancement, ses étapes en retard, ses deux prochaines
// échéances et ses alertes. Complément du Reporting (qui, lui, reprend
// les étapes choisies en puces pour être diffusé).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const adapt = (e: EtapePilotage) =>
  ({ statut: e.statut ?? undefined, fait: !!e.fait, echeance: e.echeance, date_previsionnelle: e.date_previsionnelle }) as Parameters<typeof statutOf>[0];

export default async function RevueMensuellePage() {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const [pf, service] = await Promise.all([chargerPortefeuille(ctx.communeId), createServiceClient()]);
  const { data: commune } = await service.from("communes").select("name").eq("id", ctx.communeId).maybeSingle();
  const now = new Date();
  const today = now.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });

  const lignes = pf.projets
    .filter((p) => pf.statuts.get(p.id) !== "termine")
    .map((p) => {
      const etapes = pf.etapesParProjet.get(p.id) ?? [];
      const ouvertes = etapes.filter((e) => statutOf(adapt(e)) !== "termine");
      const retards = ouvertes.filter((e) => isEnRetard(adapt(e), now));
      const prochaines = ouvertes
        .filter((e) => !isEnRetard(adapt(e), now))
        .map((e) => ({ e, d: e.date_previsionnelle ?? (e.echeance ? `${e.echeance}T00:00:00.000Z` : null) }))
        .filter((x) => x.d)
        .sort((a, b) => a.d!.localeCompare(b.d!))
        .slice(0, 2);
      return { p, retards, prochaines, alertes: pf.alertes.get(p.id), avancement: avancementAffiche(p).pct };
    });
  const groupes = new Map<string, typeof lignes>();
  for (const l of lignes) {
    const k = l.p.commission?.nom ?? "Sans commission";
    groupes.set(k, [...(groupes.get(k) ?? []), l]);
  }
  const ordre = [...groupes.keys()].sort((a, b) => (a === "Sans commission" ? 1 : b === "Sans commission" ? -1 : a.localeCompare(b, "fr")));

  return (
    <main className="civiq-main pj-detail-page pj-print">
      <div className="pj-detail-back civiq-no-print">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} aria-hidden="true" /> Tous les projets
        </Link>
        <PrintButton />
      </div>

      <h1 className="civiq-page-title">Revue mensuelle des projets — {commune?.name ?? ""}</h1>
      <p className="pj-page-subtitle">
        Édité le {today}. Projets en cours, par commission : avancement, retards, prochaines échéances et points d&apos;alerte.
      </p>

      {lignes.length === 0 ? (
        <div className="civiq-card pj-empty"><p className="pj-empty-title">Aucun projet en cours.</p></div>
      ) : (
        ordre.map((nom) => (
          <section key={nom} className="civiq-card pj-section pj-section-wide">
            <h2 className="pj-section-title">{nom}</h2>
            <div className="pj-stats-table-wrap">
              <table className="pj-table">
                <thead>
                  <tr>
                    <th scope="col">Projet</th>
                    <th scope="col">Avancement</th>
                    <th scope="col">En retard</th>
                    <th scope="col">Prochaines échéances</th>
                    <th scope="col">Alertes</th>
                  </tr>
                </thead>
                <tbody>
                  {groupes.get(nom)!.map(({ p, retards, prochaines, alertes, avancement }) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/projects/${p.id}`} className="pj-table-strong">{p.titre}</Link>
                        <div className="pj-table-sub">
                          <TypeBadge type={p.type_code} size="sm" /> {p.referent ? `· ${p.referent.nom}` : "· élu référent à désigner"}
                        </div>
                      </td>
                      <td>{avancement === null ? <span className="pj-list-muted">Non renseigné</span> : `${Math.round(avancement)} %`}</td>
                      <td className="pj-table-sub">
                        {retards.length === 0 ? "—" : retards.map((e) => (
                          <div key={e.id}><strong className="pj-text-danger">{e.libelle}</strong> — prévue le {dateReporting(e.date_previsionnelle ?? (e.echeance ? `${e.echeance}T00:00:00.000Z` : null))}</div>
                        ))}
                      </td>
                      <td className="pj-table-sub">
                        {prochaines.length === 0 ? "—" : prochaines.map(({ e, d }) => <div key={e.id}>{e.libelle} — {dateReporting(d)}</div>)}
                      </td>
                      <td>
                        {alertes?.subventionsSansAr ? <span className="civiq-badge civiq-badge-warning">Subvention sans accusé de réception</span> : null}{" "}
                        {alertes?.partCommuneKo ? <span className="civiq-badge civiq-badge-error">Part communale sous 20 %</span> : null}{" "}
                        {alertes?.delegationDepassee ? <span className="civiq-badge civiq-badge-error">Au-delà de la délégation du maire</span> : null}
                        {!alertes?.subventionsSansAr && !alertes?.partCommuneKo && !alertes?.delegationDepassee && <span className="pj-list-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </main>
  );
}
