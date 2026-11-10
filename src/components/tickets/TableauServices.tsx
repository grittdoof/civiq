import { Fragment } from "react";
import Link from "next/link";
import { formatJours, ouvert, tableau, tendance, ticketsDeLigne, type Periode, type TicketPilotage } from "@/lib/tickets/pilotage";
import { URGENCE_LABELS } from "@/lib/tickets/categories";
import { STATUT_LABELS, type TicketStatut } from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// Pilotage : tableau par service, dépliable par catégorie puis par
// ticket (chaque ticket ouvre sa fiche). Sans état : <details> + :has.
// ═══════════════════════════════════════════════════════════════

const h2: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)", margin: "0 0 12px" };

export default function TableauServices({
  tickets, periode, maintenant, total, services, categories,
}: {
  tickets: Array<TicketPilotage & { titre: string }>;
  periode: Periode;
  maintenant: Date;
  total: { ouverts: number; enCours: number; enRetard: number; delaiMoyen: number | null; clotures: number };
  services: Array<{ id: string; nom: string }>;
  categories: Array<{ id: string; libelle: string }>;
}) {
  const nomService = (id: string | null) => (id ? services.find((s) => s.id === id)?.nom ?? "Service supprimé" : "Sans service");
  const nomCategorie = (id: string | null) => (id ? categories.find((c) => c.id === id)?.libelle ?? "Catégorie supprimée" : "Sans catégorie");
  const parService = tableau(tickets, periode, (t) => t.service_id, nomService, maintenant);
  return (
    <section aria-labelledby="services" style={{ marginTop: 22 }}>
      <h2 id="services" style={h2}>Par service — dépliez un service, puis une catégorie pour voir ses tickets</h2>
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
                {sousLignes.map((s) => {
                  const liste = ticketsDeLigne(
                    tickets.filter((t) => (t.service_id ?? "__aucun") === l.cle && (t.categorie_id ?? "__aucun") === s.cle),
                    periode, maintenant,
                  );
                  return (
                    <Fragment key={s.cle}>
                      <tr className="tk-tableau-sous">
                        <th scope="row">
                          {liste.length > 0 ? (
                            <details className="tk-tableau-cat">
                              <summary>{s.libelle} <span className="tk-tableau-nb">· {liste.length} ticket{liste.length > 1 ? "s" : ""}</span></summary>
                            </details>
                          ) : <>› {s.libelle}</>}
                        </th>
                        <td className="n">{s.ouverts}</td><td className="n">{s.enCours}</td><td className="n">{s.enRetard}</td>
                        <td className="n">{formatJours(s.delaiMoyen)}</td><td className="n">{s.clotures}</td>
                        <td>{tendance(s.crees, s.creesPrecedente).texte}</td>
                      </tr>
                      {liste.length > 0 && (
                        <tr className="tk-tableau-tickets">
                          <td colSpan={7}>
                            <ul>
                              {liste.slice(0, 40).map((t) => (
                                <li key={t.id}>
                                  <Link href={`/admin/tickets/${t.id}`}>
                                    <span className="tk-tableau-num">#{t.numero}</span>
                                    <span className="tk-tableau-titre">{t.titre}</span>
                                    <span className={`tk-tableau-statut${ouvert(t) ? "" : " clos"}`}>{STATUT_LABELS[t.statut as TicketStatut] ?? t.statut}</span>
                                    {ouvert(t) && t.urgence !== "normale" && <span className="tk-tableau-urgence" data-urgence={t.urgence}>{URGENCE_LABELS[t.urgence]}</span>}
                                    <span className="tk-tableau-date">{new Date(t.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                            {liste.length > 40 && <p className="tk-tableau-plus">+ {liste.length - 40} autres tickets : affinez avec les filtres.</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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
  );
}
