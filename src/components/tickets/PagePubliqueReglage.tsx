"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Réglage de la page publique des interventions (lot 4 bis).
// ═══════════════════════════════════════════════════════════════

export default function PagePubliqueReglage({
  slug, actifInitial, themes, choisisInitial,
}: {
  slug: string;
  actifInitial: boolean;
  themes: Array<{ id: string; libelle: string; parDefaut: boolean }>;
  /** null = choix par défaut */
  choisisInitial: string[] | null;
}) {
  const [actif, setActif] = useState(actifInitial);
  const [choisis, setChoisis] = useState<string[]>(choisisInitial ?? themes.filter((t) => t.parDefaut).map((t) => t.id));
  const [etat, setEtat] = useState<"repos" | "envoi" | "ok">("repos");
  const [err, setErr] = useState<string | null>(null);
  const url = `/interventions/${slug}`;

  async function enregistrer() {
    setErr(null); setEtat("envoi");
    const r = await fetch("/api/tickets/page-publique", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif, categories: choisis }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "Enregistrement impossible"); setEtat("repos"); return; }
    setEtat("ok");
  }

  return (
    <div className="civiq-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={actif} onChange={(e) => { setActif(e.target.checked); setEtat("repos"); }} style={{ width: 20, height: 20, marginTop: 1 }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: 14.5 }}>Publier la page « Les interventions de vos services municipaux »</strong>
          <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
            Chiffres agrégés seulement (nombre d&apos;interventions, délais, thèmes) : aucun titre, adresse ni nom. Les tickets restreints et confidentiels ne sont jamais comptés.
          </span>
        </span>
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0, opacity: actif ? 1 : 0.6 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Thèmes publiés</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
          {themes.map((t) => (
            <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 36, fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" disabled={!actif} checked={choisis.includes(t.id)} style={{ width: 18, height: 18 }}
                onChange={() => { setChoisis((c) => (c.includes(t.id) ? c.filter((x) => x !== t.id) : [...c, t.id])); setEtat("repos"); }} />
              {t.libelle}
            </label>
          ))}
        </div>
      </fieldset>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="civiq-btn civiq-btn-default" onClick={enregistrer} disabled={etat === "envoi"}>
          {etat === "envoi" && <Loader2 size={14} className="civiq-spin" />} Enregistrer
        </button>
        {actifInitial && <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>Voir la page publique <ExternalLink size={13} /></a>}
        {etat === "ok" && <span role="status" style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>Enregistré{actif ? ` — page en ligne : ${url}` : " — page hors ligne"}.</span>}
        {err && <span role="alert" style={{ fontSize: 13, color: "var(--destructive)" }}>{err}</span>}
      </div>
    </div>
  );
}
