"use client";

import { useState } from "react";
import { Check, Copy, FileDown, FileText } from "lucide-react";
import { reportingEnTexte, type FiltresPilotage, type ReportingProjet } from "@/lib/projects/pilotage";

// ═══════════════════════════════════════════════════════════════
// Onglet « Reporting » (brief §2.12) : puces hiérarchisées sur trois
// niveaux (• projet / ◦ étape / ▪ détail), filtrables, exportables en
// PDF et en Word. Seules les étapes « remonter au reporting » y figurent,
// jamais les notes internes.
// ═══════════════════════════════════════════════════════════════

interface Props {
  items: ReportingProjet[];
  filtres: FiltresPilotage;
  commissions: Array<{ id: string; nom: string }>;
  sousTitre: string;
}

export default function ReportingProjets({ items, filtres, commissions, sousTitre }: Props) {
  const [copie, setCopie] = useState(false);
  const q = new URLSearchParams();
  if (filtres.commissionId) q.set("commission", filtres.commissionId);
  if (filtres.type) q.set("type", filtres.type);
  if (filtres.statut) q.set("statut", filtres.statut);
  // Écran de chargement animé, régénération à chaque clic.
  const lien = (format: "pdf" | "docx") => `/projects-pdf?${new URLSearchParams([["kind", "reporting"], ...q.entries(), ["format", format]])}`;

  async function copier() {
    try {
      await navigator.clipboard.writeText(reportingEnTexte(items));
      setCopie(true);
      setTimeout(() => setCopie(false), 1600);
    } catch { /* copie refusée par le navigateur : le texte reste sélectionnable */ }
  }

  return (
    <div className="pj-reporting">
      <form className="pj-reporting-filtres" method="get" aria-label="Filtrer le reporting">
        <input type="hidden" name="onglet" value="reporting" />
        <div className="civiq-field">
          <label htmlFor="rep-comm" className="civiq-field-label">Commission</label>
          <select id="rep-comm" name="commission" className="civiq-input" defaultValue={filtres.commissionId ?? ""}>
            <option value="">Toutes</option>
            {commissions.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            <option value="__sans__">Sans commission</option>
          </select>
        </div>
        <div className="civiq-field">
          <label htmlFor="rep-type" className="civiq-field-label">Type</label>
          <select id="rep-type" name="type" className="civiq-input" defaultValue={filtres.type ?? ""}>
            <option value="">Tous</option>
            <option value="investissement">Investissements</option>
            <option value="evenementiel">Événements</option>
            <option value="suivi_simple">Suivis simples</option>
          </select>
        </div>
        <div className="civiq-field">
          <label htmlFor="rep-statut" className="civiq-field-label">Statut du projet</label>
          <select id="rep-statut" name="statut" className="civiq-input" defaultValue={filtres.statut ?? ""}>
            <option value="">Tous</option>
            <option value="en_cours">En cours</option>
            <option value="termine">Terminé</option>
          </select>
        </div>
        <button type="submit" className="civiq-btn civiq-btn-outline civiq-btn-sm">Appliquer</button>
      </form>

      <div className="civiq-card pj-reporting-doc">
        <div className="pj-reporting-head">
          <div>
            <h2 className="pj-stats-titre">Reporting des projets</h2>
            <p className="pj-reporting-sub">{sousTitre}</p>
          </div>
          <div className="pj-reporting-actions">
            <a className="civiq-btn civiq-btn-default civiq-btn-sm" href={lien("pdf")} target="_blank" rel="noopener">
              <FileDown size={14} aria-hidden="true" /> PDF<span className="pj-sr-only"> (nouvel onglet)</span>
            </a>
            <a className="civiq-btn civiq-btn-outline civiq-btn-sm" href={lien("docx")} target="_blank" rel="noopener">
              <FileText size={14} aria-hidden="true" /> Word<span className="pj-sr-only"> (nouvel onglet)</span>
            </a>
            <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={copier} disabled={items.length === 0}>
              {copie ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copie ? "Copié" : "Copier le texte"}
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="pj-section-empty">
            Aucune étape à remonter pour ces filtres. Sur la fiche d&apos;un projet, cochez « Remonter au reporting » sur les
            étapes à faire figurer ici ; les notes internes n&apos;y apparaissent jamais.
          </p>
        ) : (
          <ul className="pj-rep-l1">
            {items.map((p) => (
              <li key={p.id}>
                <span className="pj-rep-projet">{p.titre}</span>
                <ul className="pj-rep-l2">
                  {p.lignes.map((l, i) => (
                    <li key={i}>
                      {l.texte}
                      {l.sous.length > 0 && (
                        <ul className="pj-rep-l3">
                          {l.sous.map((x, j) => <li key={j}>{x}</li>)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
