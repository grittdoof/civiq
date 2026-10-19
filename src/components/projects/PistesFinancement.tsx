"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, ExternalLink, Info, Loader2, Plus } from "lucide-react";
import { ATTRIBUTION } from "@/lib/aides/aides";
import { echeanceProche, etiquettesCategories, libelleDateLimite, trierParDateLimite } from "@/lib/aides/presentation";
import { EVT_SUBVENTION_AJOUTEE, animationsReduites, envolerVers } from "@/lib/ui/envol";

// ═══════════════════════════════════════════════════════════════
// Pistes de financement (brief §2.9) : suggestions du cache
// Aides-territoires, résultats de recherche, fiches locales.
// Interdits : aucun montant estimé, aucun taux, jamais « éligible ».
// Attribution Licence Ouverte + date de dernière mise à jour.
// « Préparer une demande » : la carte s'envole vers la liste des
// demandes, où la nouvelle demande apparaît aussitôt.
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
  /** Titre de la section (suggestions automatiques par défaut). */
  titre?: string;
  /** Aides déjà ajoutées aux demandes du projet. */
  deja?: string[];
  /** Ordre : date limite (recherche) ou pertinence (suggestions). */
  tri?: "date" | "pertinence";
  /** Nombre de pistes affichées avant « Afficher la suite ». */
  parPage?: number;
}

const dateFr = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

export default function PistesFinancement({
  projectId, aides, locaux, miseAJour, canEdit, compact = false,
  titre = "Ces financeurs pourraient correspondre", deja = [], tri = "pertinence", parPage = 4,
}: Props) {
  const router = useRouter();
  const titreId = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [ajoutes, setAjoutes] = useState<Set<string>>(() => new Set(deja));
  const [error, setError] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(parPage);
  const cartes = useRef(new Map<string, HTMLLIElement>());
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const liste = useMemo(() => (tri === "date" ? trierParDateLimite(aides) : aides), [aides, tri]);
  const total = liste.length + locaux.length;

  async function ajouter(key: string, body: Record<string, unknown>) {
    if (!projectId) return;
    setBusy(key);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/financings`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "a_demander", ...body }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(json.error ?? "La demande n'a pas été ajoutée."); return; }
    setAjoutes((s) => new Set(s).add(key));
    // La liste des demandes affiche la nouvelle ligne, puis la carte s'y envole.
    if (json.financing) window.dispatchEvent(new CustomEvent(EVT_SUBVENTION_AJOUTEE, { detail: json.financing }));
    // Laisse React afficher la nouvelle ligne (sans dépendre de requestAnimationFrame,
    // suspendu dans un onglet en arrière-plan).
    await new Promise((r) => setTimeout(r, 60));
    const cible = (json.financing && document.querySelector<HTMLElement>(`[data-subvention-id="${json.financing.id}"]`))
      || document.getElementById("subv-liste");
    await envolerVers(cartes.current.get(key) ?? null, cible);
    // La nouvelle demande, mise en évidence, est amenée à l'écran.
    cible?.scrollIntoView({ behavior: animationsReduites() ? "auto" : "smooth", block: "nearest" });
    router.refresh();
  }

  const refCarte = (key: string) => (el: HTMLLIElement | null) => {
    if (el) cartes.current.set(key, el); else cartes.current.delete(key);
  };

  const boutonAjout = (key: string, body: Record<string, unknown>) =>
    !compact && canEdit && (
      ajoutes.has(key) ? (
        <span className="pj-piste-ok" role="status"><Check size={14} aria-hidden="true" /> Ajoutée aux demandes</span>
      ) : (
        <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm pj-piste-ajout" disabled={busy === key}
          onClick={() => ajouter(key, body)}>
          {busy === key ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />} Préparer une demande
        </button>
      )
    );

  if (total === 0) {
    return compact ? null : (
      <section className="pj-pistes" aria-labelledby={titreId}>
        <h3 id={titreId} className="pj-pistes-titre">{titre}</h3>
        <p className="pj-section-empty">
          Aucune piste pour l&apos;instant. Les aides publiques sont mises à jour chaque semaine dès que le code INSEE de la commune est
          renseigné dans les paramètres.
        </p>
      </section>
    );
  }

  const aidesVisibles = liste.slice(0, visibles);
  const locauxVisibles = locaux.slice(0, Math.max(0, visibles - liste.length));
  const reste = total - aidesVisibles.length - locauxVisibles.length;

  return (
    <section className="pj-pistes" aria-labelledby={titreId}>
      <header className="pj-pistes-head">
        <h3 id={titreId} className="pj-pistes-titre">{titre}</h3>
        <div className="pj-pistes-sous">
          <p><Info size={13} aria-hidden="true" /> À vérifier : l&apos;éligibilité dépend de critères que seul le financeur peut confirmer.</p>
          {liste.length > 1 && <span className="pj-pistes-tri">{tri === "date" ? "Triées par date limite" : "Triées par pertinence"}</span>}
        </div>
      </header>
      {error && <p className="pj-modal-error" role="alert">{error}</p>}
      <ul className="pj-pistes-list">
        {aidesVisibles.map((a) => {
          const proche = echeanceProche(a.date_limite, aujourdhui);
          const tags = etiquettesCategories(a.categories);
          return (
            <li key={a.aide_id} ref={refCarte(a.aide_id)} className={`pj-piste${proche ? " is-proche" : ""}`}>
              <div className="pj-piste-top">
                <div className="pj-piste-main">
                  <p className="pj-piste-financeur">{a.financeurs.length ? a.financeurs.join(", ") : "Financeur non précisé"}</p>
                  <p className="pj-piste-nom">{a.nom}</p>
                </div>
                {a.date_limite ? (
                  <span className={`pj-piste-echeance${proche ? " is-proche" : ""}`} title={`Date limite de dépôt : ${dateFr(a.date_limite)}`}>
                    <Clock size={13} aria-hidden="true" /> {libelleDateLimite(a.date_limite)}
                  </span>
                ) : (
                  <span className="pj-piste-echeance" title="Pas de date limite annoncée">Au fil de l&apos;eau</span>
                )}
              </div>
              <div className="pj-piste-bottom">
                {tags.length > 0 && (
                  <ul className="pj-piste-tags" aria-label="Thématiques">
                    {tags.map((t) => <li key={t.label} className={`pj-piste-tag is-${t.famille}`}>{t.label}</li>)}
                  </ul>
                )}
                <div className="pj-piste-actions">
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
                      <ExternalLink size={14} aria-hidden="true" /> Voir la démarche<span className="pj-sr-only"> (nouvel onglet)</span>
                    </a>
                  )}
                  {boutonAjout(a.aide_id, { financeur: a.financeurs[0] ?? a.nom, dispositif: a.nom, aide_ref: a.aide_id, source: "api" })}
                </div>
              </div>
            </li>
          );
        })}
        {locauxVisibles.map((f) => (
          <li key={f.id} ref={refCarte(f.id)} className="pj-piste">
            <div className="pj-piste-top">
              <div className="pj-piste-main">
                <p className="pj-piste-financeur">Fiche de la commune</p>
                <p className="pj-piste-nom">{f.nom}</p>
                {f.notes && <p className="pj-piste-meta">{f.notes}</p>}
              </div>
              {f.periode_depot && <span className="pj-piste-echeance" title="Période de dépôt habituelle">{f.periode_depot}</span>}
            </div>
            <div className="pj-piste-bottom">
              <span />
              <div className="pj-piste-actions">
                {f.lien && (
                  <a href={f.lien} target="_blank" rel="noopener noreferrer" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
                    <ExternalLink size={14} aria-hidden="true" /> En savoir plus<span className="pj-sr-only"> (nouvel onglet)</span>
                  </a>
                )}
                {boutonAjout(f.id, { financeur: f.nom, financeur_local_id: f.id, source: "local" })}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {reste > 0 && (
        <p className="pj-pistes-suite">
          {reste} autre{reste > 1 ? "s" : ""} piste{reste > 1 ? "s" : ""} ·{" "}
          <button type="button" className="pj-link-btn" onClick={() => setVisibles((v) => v + 10)}>Afficher la suite</button>
        </p>
      )}
      {liste.length > 0 && (
        <p className="pj-pistes-attribution">
          Source : <a href={ATTRIBUTION.url} target="_blank" rel="noopener noreferrer">{ATTRIBUTION.source}</a> ({ATTRIBUTION.editeur}),{" "}
          {ATTRIBUTION.licence}.{miseAJour ? ` Informations mises à jour le ${dateFr(miseAJour)}.` : ""}
        </p>
      )}
    </section>
  );
}
