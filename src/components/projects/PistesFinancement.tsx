"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Plus } from "lucide-react";
import { ATTRIBUTION, AVERTISSEMENT_SUGGESTION } from "@/lib/aides/aides";

// ═══════════════════════════════════════════════════════════════
// « Ces financeurs pourraient correspondre » (brief §2.9).
// Pistes issues du cache Aides-territoires + fiches locales de la commune.
// Interdits : aucun montant estimé, aucun taux, jamais « éligible ».
// Attribution Licence Ouverte + date de dernière mise à jour.
// ═══════════════════════════════════════════════════════════════

export interface PisteAide {
  aide_id: string;
  nom: string;
  url: string | null;
  financeurs: string[];
  categories: string[];
  date_limite: string | null;
}
export interface PisteLocale {
  id: string;
  nom: string;
  periode_depot: string | null;
  lien: string | null;
  notes: string | null;
}

interface Props {
  projectId?: string;
  aides: PisteAide[];
  locaux: PisteLocale[];
  miseAJour: string | null;
  canEdit: boolean;
  /** Assistant de création : pas encore de projet, pas de bouton d'ajout. */
  compact?: boolean;
}

const dateFr = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

export default function PistesFinancement({ projectId, aides, locaux, miseAJour, canEdit, compact = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [ajoutes, setAjoutes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function ajouter(key: string, body: Record<string, unknown>) {
    if (!projectId) return;
    setBusy(key);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/financings`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "a_demander", ...body }),
    });
    setBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "La demande n'a pas été ajoutée."); return; }
    setAjoutes((s) => new Set(s).add(key));
    router.refresh();
  }

  if (aides.length === 0 && locaux.length === 0) {
    return compact ? null : (
      <section className="pj-pistes" aria-labelledby="pistes-titre">
        <h3 id="pistes-titre" className="pj-budget-section-title">Ces financeurs pourraient correspondre</h3>
        <p className="pj-section-empty">
          Aucune piste pour l&apos;instant. Les aides publiques sont mises à jour chaque semaine dès que le code INSEE de la commune est
          renseigné dans les paramètres.
        </p>
      </section>
    );
  }

  return (
    <section className="pj-pistes" aria-labelledby="pistes-titre">
      <h3 id="pistes-titre" className="pj-budget-section-title">Ces financeurs pourraient correspondre</h3>
      <p className="pj-pistes-avertissement">{AVERTISSEMENT_SUGGESTION}</p>
      {error && <p className="pj-modal-error" role="alert">{error}</p>}
      <ul className="pj-pistes-list">
        {aides.map((a) => (
          <li key={a.aide_id} className="pj-piste">
            <div className="pj-piste-main">
              <p className="pj-piste-nom">{a.nom}</p>
              <p className="pj-piste-meta">
                {a.financeurs.length ? a.financeurs.join(", ") : "Financeur non précisé"}
                {a.categories.length ? ` · ${a.categories.slice(0, 2).join(", ")}` : ""}
              </p>
              <p className="pj-piste-meta">
                {a.date_limite ? <strong>Date limite de dépôt : {dateFr(a.date_limite)}</strong> : "Dépôt au fil de l'eau (pas de date limite annoncée)"}
              </p>
            </div>
            <div className="pj-piste-actions">
              {a.url && (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
                  <ExternalLink size={14} aria-hidden="true" /> Voir la démarche<span className="pj-sr-only"> (nouvel onglet)</span>
                </a>
              )}
              {!compact && canEdit && (
                ajoutes.has(a.aide_id) ? <span className="pj-piste-ok">Ajoutée aux demandes</span> : (
                  <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" disabled={busy === a.aide_id}
                    onClick={() => ajouter(a.aide_id, { financeur: a.financeurs[0] ?? a.nom, dispositif: a.nom, aide_ref: a.aide_id, source: "api" })}>
                    {busy === a.aide_id ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />} Préparer une demande
                  </button>
                )
              )}
            </div>
          </li>
        ))}
        {locaux.map((f) => (
          <li key={f.id} className="pj-piste">
            <div className="pj-piste-main">
              <p className="pj-piste-nom">{f.nom} <span className="pj-piste-badge">Fiche de la commune</span></p>
              {f.periode_depot && <p className="pj-piste-meta"><strong>Période de dépôt habituelle : {f.periode_depot}</strong></p>}
              {f.notes && <p className="pj-piste-meta">{f.notes}</p>}
            </div>
            <div className="pj-piste-actions">
              {f.lien && (
                <a href={f.lien} target="_blank" rel="noopener noreferrer" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
                  <ExternalLink size={14} aria-hidden="true" /> En savoir plus<span className="pj-sr-only"> (nouvel onglet)</span>
                </a>
              )}
              {!compact && canEdit && (
                ajoutes.has(f.id) ? <span className="pj-piste-ok">Ajoutée aux demandes</span> : (
                  <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" disabled={busy === f.id}
                    onClick={() => ajouter(f.id, { financeur: f.nom, financeur_local_id: f.id, source: "local" })}>
                    {busy === f.id ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />} Préparer une demande
                  </button>
                )
              )}
            </div>
          </li>
        ))}
      </ul>
      {aides.length > 0 && (
        <p className="pj-pistes-attribution">
          Source : <a href={ATTRIBUTION.url} target="_blank" rel="noopener noreferrer">{ATTRIBUTION.source}</a> ({ATTRIBUTION.editeur}),{" "}
          {ATTRIBUTION.licence}.{miseAJour ? ` Informations mises à jour le ${dateFr(miseAJour)}.` : ""}
        </p>
      )}
    </section>
  );
}
