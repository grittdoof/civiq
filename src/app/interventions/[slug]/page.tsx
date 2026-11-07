import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerPagePublique } from "@/lib/tickets/public-server";
import type { PeriodePublique } from "@/lib/tickets/public";

// ═══════════════════════════════════════════════════════════════
// /interventions/<commune> — tableau de bord public des interventions
// (lot 4 bis, maquette 4A adaptée). Sans connexion ; activé par la
// commune. Chiffres agrégés, mis à jour toutes les heures.
// ═══════════════════════════════════════════════════════════════

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ periode?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await chargerPagePublique(slug, "30j");
  if (!page) return { title: "Page introuvable" };
  return {
    title: `Interventions des services municipaux — ${page.commune.nom}`,
    description: `Les interventions réalisées par les services de la commune de ${page.commune.nom} : chiffres clés, délais, thèmes.`,
  };
}

const jours = (j: number | null) => (j === null ? "—" : `${j.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} jour${j >= 2 ? "s" : ""}`);

export default async function InterventionsPubliques({ params, searchParams }: Props) {
  const { slug } = await params;
  const { periode: p } = await searchParams;
  const periode: PeriodePublique = p === "12m" ? "12m" : "30j";
  const page = await chargerPagePublique(slug, periode);
  if (!page) notFound();
  const { commune, agregats: a } = page;
  const max = Math.max(1, ...a.parMois.map((m) => m.terminees));
  const libellePeriode = periode === "30j" ? "30 derniers jours" : "12 derniers mois";

  return (
    <div className="pub-interventions">
      <header className="pub-entete">
        <div className="pub-entete-contenu">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {commune.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={commune.logo} alt={`Logo de ${commune.nom}`} className="pub-logo" />
            )}
            <div>
              <p className="pub-sur-titre">Mairie de {commune.nom}</p>
              <h1>Les interventions de vos services municipaux</h1>
            </div>
          </div>
          <p className="pub-maj">
            Mis à jour le {new Date(page.misAJour).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}
          </p>
        </div>
      </header>

      <main className="pub-corps">
        <nav aria-label="Période" className="pub-periodes">
          <Link href={`/interventions/${slug}`} aria-current={periode === "30j" ? "page" : undefined}>30 derniers jours</Link>
          <Link href={`/interventions/${slug}?periode=12m`} aria-current={periode === "12m" ? "page" : undefined}>12 derniers mois</Link>
        </nav>

        <section aria-label="Chiffres clés" className="pub-kpis">
          <div><b>{a.terminees}</b><span>intervention{a.terminees > 1 ? "s" : ""} terminée{a.terminees > 1 ? "s" : ""} sur les {libellePeriode}</span></div>
          <div><b>{jours(a.delaiMoyenJours)}</b><span>délai moyen entre le signalement et la fin de l&apos;intervention</span></div>
          <div><b>{a.priseEnCharge48h === null ? "—" : `${a.priseEnCharge48h} %`}</b><span>des signalements pris en charge en moins de 48 h</span></div>
          <div><b>{a.enCours}</b><span>demande{a.enCours > 1 ? "s" : ""} en cours de traitement</span></div>
        </section>

        {a.parTheme.length > 0 && (
          <section aria-labelledby="themes">
            <h2 id="themes" className="pub-h2">Par thème — {libellePeriode}</h2>
            <div className="pub-themes">
              {a.parTheme.map((t) => (
                <div key={t.id} className="pub-theme">
                  <strong>{t.libelle}</strong>
                  <dl>
                    <div><dt>Terminées</dt><dd>{t.terminees}</dd></div>
                    <div><dt>En cours</dt><dd>{t.enCours}</dd></div>
                    <div><dt>Délai moyen</dt><dd>{jours(t.delaiMoyenJours)}</dd></div>
                  </dl>
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="mois" className="pub-carte">
          <h2 id="mois" className="pub-h2">Interventions terminées par mois</h2>
          <div className="pub-barres" role="img" aria-label={a.parMois.map((m) => `${m.libelle} : ${m.terminees}`).join(", ")}>
            {a.parMois.map((m) => (
              <div key={m.cle}>
                <span className="pub-barre-valeur">{m.terminees}</span>
                <i style={{ height: `${Math.round((m.terminees / max) * 140)}px` }} />
                <span>{m.libelle}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="signaler" className="pub-carte pub-signaler">
          <div>
            <h2 id="signaler" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#042F64" }}>Un problème sur la voie publique ?</h2>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#5F6672" }}>Contactez la mairie : votre demande sera enregistrée et suivie.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {commune.telephone && <a className="pub-bouton" href={`tel:${commune.telephone.replace(/\s/g, "")}`}>Appeler la mairie · {commune.telephone}</a>}
            {commune.email && <a className="pub-bouton pub-bouton-secondaire" href={`mailto:${commune.email}`}>Écrire à la mairie</a>}
          </div>
        </section>

        <footer className="pub-pied">
          Chiffres agrégés, sans aucune information personnelle ni détail des demandes. Ne sont pas publiés : les signalements
          restreints ou confidentiels et les thèmes que la commune choisit de ne pas afficher.{" "}
          <a href={`/interventions/${slug}/donnees?periode=${periode}`}>Télécharger les chiffres (CSV)</a> · Service proposé par GoCiviq.
        </footer>
      </main>
    </div>
  );
}
