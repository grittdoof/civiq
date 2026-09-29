"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Statistiques } from "@/lib/projects/pilotage";

// ═══════════════════════════════════════════════════════════════
// Onglet « Statistiques » (brief §2.12) : 4 blocs, chacun doublé d'un
// tableau de données équivalent (RGAA). Graphiques recharts chargés en
// différé ; les chiffres clés restent lisibles en texte entre-temps.
// ═══════════════════════════════════════════════════════════════

type Charts = typeof import("./StatsCharts");

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur = (n: number) => EUR.format(n);
const pctTxt = (n: number | null) => (n === null ? "non renseigné" : `${n} %`);

function Bloc({ titre, resume, graphique, tableau }: { titre: string; resume: string; graphique: ReactNode; tableau: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  return (
    <section className="civiq-card pj-stats-bloc" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="pj-stats-titre">{titre}</h2>
      <figure className="pj-stats-figure">
        <div className="pj-stats-chart" aria-hidden="true">{graphique}</div>
        <figcaption className="pj-stats-resume">{resume}</figcaption>
      </figure>
      <button type="button" className="pj-learn-more-toggle" aria-expanded={ouvert} aria-controls={`${id}-d`} onClick={() => setOuvert((o) => !o)}>
        {ouvert ? "Masquer le tableau des chiffres" : "Voir le tableau des chiffres"}
        <ChevronDown size={14} aria-hidden="true" className={ouvert ? "pj-learn-more-chevron open" : "pj-learn-more-chevron"} />
      </button>
      <div id={`${id}-d`} hidden={!ouvert} className="pj-stats-table-wrap">{tableau}</div>
    </section>
  );
}

export default function StatistiquesProjets({ stats }: { stats: Statistiques }) {
  const [C, setC] = useState<Charts | null>(null);
  useEffect(() => {
    let alive = true;
    import("./StatsCharts").then((m) => { if (alive) setC(m); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const attente = <p className="pj-params-note">Chargement du graphique…</p>;
  const lignes = stats.parCommission;

  if (stats.nbProjets === 0) {
    return <p className="pj-section-empty">Aucun projet actif : les statistiques apparaîtront avec vos premiers projets.</p>;
  }

  return (
    <div className="pj-stats">
      <section className="civiq-card pj-stats-bloc" aria-labelledby="st-general">
        <h2 id="st-general" className="pj-stats-titre">Avancement général</h2>
        <div className="pj-stats-general">
          <span className="pj-stats-big">{stats.avancementGeneral === null ? "—" : `${stats.avancementGeneral} %`}</span>
          <div className="pj-stats-track" aria-hidden="true">
            <div className="pj-stats-fill" style={{ width: `${stats.avancementGeneral ?? 0}%` }} />
          </div>
          <p className="pj-stats-resume">
            Moyenne des {stats.nbAvancementRenseigne} projet{stats.nbAvancementRenseigne > 1 ? "s" : ""} dont l&apos;avancement est renseigné,
            sur {stats.nbProjets} projet{stats.nbProjets > 1 ? "s" : ""} actif{stats.nbProjets > 1 ? "s" : ""}. L&apos;avancement d&apos;un projet
            se calcule sur ses étapes clés terminées.
          </p>
        </div>
      </section>

      <Bloc
        titre="Avancement par commission"
        resume={lignes.map((l) => `${l.nom} : ${pctTxt(l.avancement)}`).join(" · ")}
        graphique={C ? <C.AvancementChart lignes={lignes} /> : attente}
        tableau={
          <table className="pj-stats-table">
            <caption className="pj-sr-only">Avancement moyen par commission</caption>
            <thead><tr><th scope="col">Commission</th><th scope="col">Projets</th><th scope="col">Avancement moyen</th></tr></thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id ?? "sans"}><th scope="row">{l.nom}</th><td>{l.nbProjets}</td><td>{pctTxt(l.avancement)}</td></tr>
              ))}
            </tbody>
          </table>
        }
      />

      <Bloc
        titre="Budget par commission : prévu, engagé, payé (hors taxes)"
        resume={`Total : ${eur(stats.budget.prevuHt)} prévus, ${eur(stats.budget.engageHt)} engagés (devis signés), ${eur(stats.budget.mandateHt)} payés.`}
        graphique={C ? <div className="pj-stats-budget"><C.BudgetChart lignes={lignes} /></div> : attente}
        tableau={
          <table className="pj-stats-table">
            <caption className="pj-sr-only">Budget hors taxes par commission</caption>
            <thead><tr><th scope="col">Commission</th><th scope="col">Prévu HT</th><th scope="col">Engagé HT</th><th scope="col">Payé HT</th></tr></thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id ?? "sans"}><th scope="row">{l.nom}</th><td>{eur(l.prevuHt)}</td><td>{eur(l.engageHt)}</td><td>{eur(l.mandateHt)}</td></tr>
              ))}
              <tr className="pj-stats-total"><th scope="row">Total</th><td>{eur(stats.budget.prevuHt)}</td><td>{eur(stats.budget.engageHt)}</td><td>{eur(stats.budget.mandateHt)}</td></tr>
            </tbody>
          </table>
        }
      />

      <Bloc
        titre="Subventions"
        resume={`${eur(stats.subventions.sollicitees)} sollicités, ${eur(stats.subventions.accordees)} accordés, ${eur(stats.subventions.encaissees)} encaissés.`}
        graphique={C ? <C.SubventionsChart s={stats.subventions} /> : attente}
        tableau={
          <table className="pj-stats-table">
            <caption className="pj-sr-only">Subventions par étape</caption>
            <thead><tr><th scope="col">Étape</th><th scope="col">Montant</th><th scope="col">Ce que cela recouvre</th></tr></thead>
            <tbody>
              <tr><th scope="row">Sollicitées</th><td>{eur(stats.subventions.sollicitees)}</td><td>Demandes déposées (avec ou sans accusé de réception), accordées ou versées</td></tr>
              <tr><th scope="row">Accordées</th><td>{eur(stats.subventions.accordees)}</td><td>Notifiées par le financeur, versées ou non</td></tr>
              <tr><th scope="row">Encaissées</th><td>{eur(stats.subventions.encaissees)}</td><td>Versées à la commune (statut « versée »)</td></tr>
            </tbody>
          </table>
        }
      />
    </div>
  );
}
