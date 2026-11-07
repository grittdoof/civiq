import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { chargerSpectateur } from "@/lib/tickets/droits-server";
import { valeurAction } from "@/lib/tickets/droits";
import { chargerPilotage, filtrer, type FiltresPilotage } from "@/lib/tickets/pilotage-server";
import {
  PERIODES, alertes, formatJours, indicateurs, ouvert, tableau, tendance, type Periode,
} from "@/lib/tickets/pilotage";
import { URGENCES, URGENCE_LABELS, estUrgence } from "@/lib/tickets/categories";
import TicketsMap from "../carte/TicketsMap";
import PrintAutoTrigger from "../imprimer/PrintAutoTrigger";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/pilotage — vue direction (lot 4, maquette 4B).
// Alertes d'abord, chiffres clés, tableau par service dépliable par
// catégorie, top catégories, carte des tickets ouverts.
// Confidentiels exclus ; restreints non ouvrables comptés sans détail.
// ?periode=7j|30j|trimestre|annee&service=&categorie=&urgence=&imprimer=1
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const JOURS_SANS_REPONSE = 7;

interface Props {
  searchParams: Promise<{ periode?: string; service?: string; categorie?: string; urgence?: string; imprimer?: string }>;
}

const h2: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)", margin: "0 0 12px" };

export default async function PilotagePage({ searchParams }: Props) {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin" && !(await isModuleActive("tickets"))) redirect("/admin/dashboard?module=tickets&state=inactive");
  const spectateur = await chargerSpectateur();
  if (!spectateur || (spectateur.role !== "super_admin" && (!spectateur.ligne || spectateur.ligne.voit === "rien" || spectateur.ligne.voit === "siens"))) {
    redirect("/admin/tickets");
  }

  const sp = await searchParams;
  const periode: Periode = PERIODES.some((p) => p.valeur === sp.periode) ? (sp.periode as Periode) : "30j";
  const filtres: FiltresPilotage = {
    serviceId: sp.service || undefined,
    categorieRacineId: sp.categorie || undefined,
    urgence: estUrgence(sp.urgence) ? sp.urgence : undefined,
  };
  const imprimer = sp.imprimer === "1";

  const { tickets: tous, categories, services } = await chargerPilotage(ctx.communeId, spectateur);
  const tickets = filtrer(tous, filtres);
  const maintenant = new Date();
  const ind = indicateurs(tickets, periode, maintenant);
  const al = alertes(tickets, JOURS_SANS_REPONSE, maintenant);
  const nomService = (id: string | null) => (id ? services.find((s) => s.id === id)?.nom ?? "Service supprimé" : "Sans service");
  const nomCategorie = (id: string | null) => (id ? categories.find((c) => c.id === id)?.libelle ?? "Catégorie supprimée" : "Sans catégorie");
  const parService = tableau(tickets, periode, (t) => t.service_id, nomService, maintenant);
  const topCategories = tableau(tickets, periode, (t) => t.categorie_id, nomCategorie, maintenant)
    .filter((l) => l.crees > 0).sort((a, b) => b.crees - a.crees).slice(0, 6);
  const total = { ouverts: ind.ouverts, enCours: ind.enCours, enRetard: ind.enRetard, delaiMoyen: ind.delaiMoyen, clotures: ind.clotures };
  const libellePeriode = PERIODES.find((p) => p.valeur === periode)!.libelle.toLowerCase();
  const peutExporter = valeurAction("exporter", spectateur) === "oui";
  const racines = categories.filter((c) => !c.parent_id && c.actif);

  const lien = (o: Partial<{ periode: string; imprimer: string }>) => {
    const p = new URLSearchParams();
    p.set("periode", o.periode ?? periode);
    if (filtres.serviceId) p.set("service", filtres.serviceId);
    if (filtres.categorieRacineId) p.set("categorie", filtres.categorieRacineId);
    if (filtres.urgence) p.set("urgence", filtres.urgence);
    if (o.imprimer) p.set("imprimer", o.imprimer);
    return `/admin/tickets/pilotage?${p.toString()}`;
  };
  const exportCsv = (type: string) => {
    const p = new URLSearchParams(lien({}).split("?")[1]);
    p.set("type", type);
    return `/api/tickets/pilotage/export?${p.toString()}`;
  };

  const geo = tickets.filter((t) => !t.masque && ouvert(t) && t.latitude != null && t.longitude != null);
  const nbAlertes = al.danger.length + (al.sansReponse.length > 0 ? 1 : 0) + (al.enRetard.length > 0 ? 1 : 0);
  const tc = tendance(ind.clotures, ind.cloturesPrecedente);

  return (
    <main className={`civiq-main tk-pilotage${imprimer ? " tk-pilotage-impression" : ""}`}>
      {imprimer && <PrintAutoTrigger />}
      <Link href="/admin/tickets" className="tk-pilotage-retour" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 12 }}>
        <ArrowLeft size={14} /> Interventions
      </Link>

      <header style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h1 className="civiq-page-title" style={{ margin: 0 }}>Interventions — vue direction</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--fg-muted)" }}>
            Période : {libellePeriode} · {maintenant.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <nav aria-label="Période" className="tk-pilotage-periodes">
          {PERIODES.map((p) => (
            <Link key={p.valeur} href={lien({ periode: p.valeur })} aria-current={p.valeur === periode ? "page" : undefined}>{p.libelle}</Link>
          ))}
        </nav>
      </header>

      <form method="get" action="/admin/tickets/pilotage" className="tk-pilotage-filtres">
        <input type="hidden" name="periode" value={periode} />
        <label>Service
          <select name="service" defaultValue={filtres.serviceId ?? ""}>
            <option value="">Tous</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            <option value="aucun">Sans service</option>
          </select>
        </label>
        <label>Catégorie
          <select name="categorie" defaultValue={filtres.categorieRacineId ?? ""}>
            <option value="">Toutes</option>
            {racines.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        </label>
        <label>Urgence
          <select name="urgence" defaultValue={filtres.urgence ?? ""}>
            <option value="">Toutes</option>
            {URGENCES.map((u) => <option key={u} value={u}>{URGENCE_LABELS[u]}</option>)}
          </select>
        </label>
        <button type="submit" className="civiq-btn civiq-btn-outline">Filtrer</button>
        {peutExporter && (
          <span className="tk-pilotage-exports">
            <a className="civiq-btn civiq-btn-outline" href={exportCsv("services")}><Download size={14} /> CSV services</a>
            <a className="civiq-btn civiq-btn-outline" href={exportCsv("tickets")}><Download size={14} /> CSV tickets</a>
            <Link className="civiq-btn civiq-btn-default" href={lien({ imprimer: "1" })} target="_blank"><Printer size={14} /> Version imprimable</Link>
          </span>
        )}
      </form>

      <div className="tk-pilotage-haut">
        <section aria-labelledby="alertes" className="civiq-card tk-pilotage-alertes">
          <h2 id="alertes" style={{ ...h2, color: nbAlertes > 0 ? "#B0000F" : "var(--fg-muted)" }}>À traiter maintenant · {nbAlertes}</h2>
          {nbAlertes === 0 && <p style={{ margin: 0, fontSize: 14, color: "var(--fg-muted)" }}>Rien d&apos;urgent : aucun danger immédiat en attente, aucun retard.</p>}
          <ul className="tk-alertes">
            {al.danger.map((t) => (
              <li key={t.id}>
                <span className="tk-alerte-point" style={{ background: "#E00114" }} aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>#{t.numero} {t.titre} — danger immédiat</strong>
                  <span className="tk-alerte-detail">{nomService(t.service_id)} · non pris en charge depuis {Math.max(1, Math.round((maintenant.getTime() - new Date(t.created_at).getTime()) / 60_000))} min</span>
                </span>
                <Link href={`/admin/tickets/${t.id}`}>Ouvrir</Link>
              </li>
            ))}
            {al.sansReponse.length > 0 && (
              <li>
                <span className="tk-alerte-point" style={{ background: "#E08A00" }} aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{al.sansReponse.length} ticket{al.sansReponse.length > 1 ? "s" : ""} pas encore démarré{al.sansReponse.length > 1 ? "s" : ""} depuis plus de {JOURS_SANS_REPONSE} jours</strong>
                  <span className="tk-alerte-detail">{al.sansReponse.slice(0, 5).map((t) => `#${t.numero}`).join(", ")}{al.sansReponse.length > 5 ? "…" : ""}</span>
                </span>
                <Link href="/admin/tickets?vue=non_assignes">Voir</Link>
              </li>
            )}
            {al.enRetard.length > 0 && (
              <li>
                <span className="tk-alerte-point" style={{ background: "#E08A00" }} aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{al.enRetard.length} ticket{al.enRetard.length > 1 ? "s" : ""} au-delà du délai cible</strong>
                  <span className="tk-alerte-detail">
                    {Object.entries(al.enRetard.reduce<Record<string, number>>((acc, t) => { const k = nomService(t.service_id); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}))
                      .map(([k, n]) => `${k} (${n})`).join(", ")}
                  </span>
                </span>
                <Link href="/admin/tickets?vue=tous">Voir</Link>
              </li>
            )}
          </ul>
        </section>

        <section aria-label="Chiffres clés" className="tk-pilotage-kpis">
          <div className="tk-kpi"><b>{ind.ouverts}</b><span>Ouverts</span></div>
          <div className="tk-kpi"><b>{ind.clotures}</b><span>Clôturés ({tc.sens === "stable" ? "stable" : tc.texte.replace("En hausse : ", "").replace("En baisse : ", "")})</span></div>
          <div className="tk-kpi"><b>{formatJours(ind.delaiMoyen)}</b><span>Délai moyen</span></div>
          <div className="tk-kpi"><b>{ind.priseEnCharge24h === null ? "—" : `${ind.priseEnCharge24h} %`}</b><span>Pris en charge sous 24 h</span></div>
          <p className="tk-kpi-note">
            {ind.masques > 0 ? `Dont ${ind.masques} ticket${ind.masques > 1 ? "s" : ""} restreint${ind.masques > 1 ? "s" : ""}, compté${ind.masques > 1 ? "s" : ""} sans détail. ` : ""}Les tickets confidentiels ne figurent pas dans ce tableau.
          </p>
        </section>
      </div>

      <section aria-labelledby="services" style={{ marginTop: 22 }}>
        <h2 id="services" style={h2}>Par service — cliquez une ligne pour le détail par catégorie</h2>
        <div className="tk-tableau">
          <table>
            <thead>
              <tr>
                <th scope="col">Service</th><th scope="col" className="n">Ouverts</th><th scope="col" className="n">En cours</th>
                <th scope="col" className="n">En retard</th><th scope="col" className="n">Délai moyen</th><th scope="col" className="n">Clôturés</th>
                <th scope="col">Tendance (créés)</th>
              </tr>
            </thead>
            {parService.map((l) => {
              const tend = tendance(l.crees, l.creesPrecedente);
              const sousLignes = tableau(tickets.filter((t) => (t.service_id ?? "__aucun") === l.cle), periode, (t) => t.categorie_id, nomCategorie, maintenant);
              return (
                <tbody key={l.cle} className="tk-tableau-groupe">
                  <tr>
                    <th scope="row">
                      <details>
                        <summary>{l.libelle}</summary>
                      </details>
                    </th>
                    <td className="n">{l.ouverts}</td><td className="n">{l.enCours}</td>
                    <td className="n" style={l.enRetard > 0 ? { color: "#8A4B00", fontWeight: 700 } : undefined}>{l.enRetard}</td>
                    <td className="n">{formatJours(l.delaiMoyen)}</td><td className="n">{l.clotures}</td>
                    <td style={{ color: tend.sens === "hausse" ? "#8A4B00" : tend.sens === "baisse" ? "#13693A" : "var(--fg-muted)", fontWeight: tend.sens === "stable" ? 400 : 600 }}>{tend.texte}</td>
                  </tr>
                  {sousLignes.map((s) => (
                    <tr key={s.cle} className="tk-tableau-sous">
                      <th scope="row">› {s.libelle}</th>
                      <td className="n">{s.ouverts}</td><td className="n">{s.enCours}</td><td className="n">{s.enRetard}</td>
                      <td className="n">{formatJours(s.delaiMoyen)}</td><td className="n">{s.clotures}</td>
                      <td>{tendance(s.crees, s.creesPrecedente).texte}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
            <tbody>
              <tr className="tk-tableau-total">
                <th scope="row">Total</th><td className="n">{total.ouverts}</td><td className="n">{total.enCours}</td>
                <td className="n">{total.enRetard}</td><td className="n">{formatJours(total.delaiMoyen)}</td><td className="n">{total.clotures}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="tk-pilotage-bas">
        <section aria-labelledby="top" className="civiq-card" style={{ padding: 18 }}>
          <h2 id="top" style={h2}>Catégories les plus signalées · {libellePeriode}</h2>
          {topCategories.length === 0 ? <p style={{ margin: 0, fontSize: 13.5, color: "var(--fg-muted)" }}>Aucun ticket créé sur la période.</p> : (
            <ul className="tk-top">
              {topCategories.map((c) => {
                const max = topCategories[0].crees;
                const tend = tendance(c.crees, c.creesPrecedente);
                return (
                  <li key={c.cle}>
                    <span className="tk-top-libelle">{c.libelle}</span>
                    <span className="tk-top-barre" aria-hidden="true"><i style={{ width: `${Math.round((c.crees / max) * 100)}%` }} /></span>
                    <b>{c.crees}</b>
                    <span className="tk-top-tendance">{tend.texte.replace("En hausse : ", "").replace("En baisse : ", "")}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section aria-labelledby="carte" className="civiq-card tk-pilotage-carte" style={{ padding: 18 }}>
          <h2 id="carte" style={h2}>Tickets ouverts sur la commune · {geo.length}</h2>
          {geo.length === 0 ? <p style={{ margin: 0, fontSize: 13.5, color: "var(--fg-muted)" }}>Aucun ticket ouvert géolocalisé.</p> : (
            <TicketsMap
              hauteur={320}
              center={[geo[0].latitude!, geo[0].longitude!]}
              tickets={geo.map((t) => ({
                id: t.id, numero: t.numero, titre: t.titre, priorite: t.priorite as never, statut: t.statut as never,
                categorie: t.categorie as never, latitude: t.latitude!, longitude: t.longitude!, adresse: t.adresse, photoUrl: null,
              }))}
            />
          )}
        </section>
      </div>
    </main>
  );
}

