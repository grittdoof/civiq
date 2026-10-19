"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Search } from "lucide-react";
import PistesFinancement, { type PisteAide } from "./PistesFinancement";

// ═══════════════════════════════════════════════════════════════
// Recherche de financements par mots-clés dans Aides-territoires
// (à la demande, côté serveur). Les résultats s'ajoutent aux demandes
// du projet comme les suggestions automatiques.
// ═══════════════════════════════════════════════════════════════

export default function RechercheAides({
  projectId, canEdit, deja, motsSuggeres,
}: { projectId: string; canEdit: boolean; deja: string[]; motsSuggeres?: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<{ q: string; resultats: PisteAide[] } | null>(null);

  async function chercher(e: FormEvent) {
    e.preventDefault();
    const mots = q.trim();
    if (mots.length < 2) { setError("Saisissez au moins deux caractères."); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/aides/recherche?q=${encodeURIComponent(mots)}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "La recherche a échoué.");
      setRes({ q: j.q, resultats: j.resultats ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "La recherche a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pj-recherche-aides civiq-card" aria-labelledby="recherche-aides-titre">
      <h3 id="recherche-aides-titre" className="pj-pistes-titre">Rechercher un financement</h3>
      <form className="pj-recherche-aides-form" onSubmit={chercher} role="search">
        <span className="pj-recherche-aides-champ">
          <label htmlFor="recherche-aides-q" className="pj-sr-only">Mots-clés</label>
          <Search size={16} className="pj-recherche-aides-icone" aria-hidden="true" />
          <input id="recherche-aides-q" type="search" className="civiq-input" value={q} maxLength={100}
            placeholder={motsSuggeres ? `Ex. ${motsSuggeres}` : "Ex. cour d'école, éclairage public, accessibilité"}
            onChange={(e) => setQ(e.target.value)} />
        </span>
        <button type="submit" className="civiq-btn civiq-btn-default" disabled={busy}>
          {busy ? <Loader2 size={15} className="civiq-spin" aria-hidden="true" /> : null} Rechercher
        </button>
      </form>
      <p className="civiq-field-hint">
        Aides-territoires, parmi les aides ouvertes aux communes de votre territoire. Préférez un mot précis :
        « préau », « rénovation énergétique », « city stade ».
      </p>
      {error && <p className="pj-modal-error" role="alert">{error}</p>}
      <div aria-live="polite">
        {res && (res.resultats.length === 0 ? (
          <p className="pj-section-empty">Aucune aide ouverte ne correspond à « {res.q} ». Essayez un autre mot, plus général.</p>
        ) : (
          <PistesFinancement
            key={res.q}
            projectId={projectId}
            aides={res.resultats}
            locaux={[]}
            miseAJour={new Date().toISOString()}
            canEdit={canEdit}
            deja={deja}
            titre={`${res.resultats.length} piste${res.resultats.length > 1 ? "s" : ""} pour « ${res.q} »`}
            tri="date"
          />
        ))}
      </div>
    </section>
  );
}
