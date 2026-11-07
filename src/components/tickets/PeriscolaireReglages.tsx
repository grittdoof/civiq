"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { TYPES_SITE, type TypeSite } from "@/lib/tickets/periscolaire";

// ═══════════════════════════════════════════════════════════════
// Périscolaire (lot 5) : lieux de la commune et délai d'effacement
// du prénom de l'enfant.
// ═══════════════════════════════════════════════════════════════

export interface Site { id: string; nom: string; type: TypeSite; adresse: string | null }

const champ: React.CSSProperties = { height: 40, borderRadius: 8, border: "1px solid var(--border)", padding: "0 10px", font: "inherit", fontSize: 14, background: "var(--bg-card, #fff)" };
const libelleType = (t: TypeSite) => TYPES_SITE.find((x) => x.valeur === t)?.libelle ?? t;

async function appel(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Erreur");
  return j;
}

export default function PeriscolaireReglages({ sitesInitiaux, effacementInitial }: { sitesInitiaux: Site[]; effacementInitial: number | null }) {
  const [sites, setSites] = useState(sitesInitiaux);
  const [nom, setNom] = useState("");
  const [type, setType] = useState<TypeSite>("ecole");
  const [edition, setEdition] = useState<string | null>(null);
  const [nomEdite, setNomEdite] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [effacement, setEffacement] = useState<number | null>(effacementInitial);
  const [effOk, setEffOk] = useState(false);

  async function agir(f: () => Promise<void>) {
    setErr(null); setOccupe(true);
    try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); } finally { setOccupe(false); }
  }
  const ajouter = () => agir(async () => {
    const { site } = await appel("/api/tickets/sites", "POST", { nom, type });
    setSites((s) => [...s, site].sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
    setNom("");
  });
  const renommer = (s: Site) => agir(async () => {
    const { site } = await appel(`/api/tickets/sites/${s.id}`, "PATCH", { nom: nomEdite, type: s.type, adresse: s.adresse });
    setSites((l) => l.map((x) => (x.id === s.id ? site : x)));
    setEdition(null);
  });
  const supprimer = (s: Site) => agir(async () => {
    if (!window.confirm(`Retirer « ${s.nom} » ? Les tickets déjà rattachés le gardent dans leur historique.`)) return;
    await appel(`/api/tickets/sites/${s.id}`, "DELETE");
    setSites((l) => l.filter((x) => x.id !== s.id));
  });
  const enregistrerEffacement = (v: number | null) => agir(async () => {
    setEffacement(v); setEffOk(false);
    await appel("/api/tickets/periscolaire", "PUT", { effacement_mois: v });
    setEffOk(true);
  });

  return (
    <div className="civiq-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Lieux</h3>
        {sites.length === 0 ? (
          <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--fg-muted)" }}>Aucun lieu. Ajoutez vos écoles, accueils de loisirs et restaurants scolaires.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: "0 0 10px", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {sites.map((s) => (
              <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, borderBottom: "1px solid var(--border-light)" }}>
                {edition === s.id ? (
                  <>
                    <input style={{ ...champ, flex: 1 }} value={nomEdite} onChange={(e) => setNomEdite(e.target.value)} maxLength={120} aria-label="Nom du lieu" autoFocus />
                    <button type="button" className="civiq-btn civiq-btn-default" disabled={occupe} onClick={() => renommer(s)} style={{ fontSize: 13 }}>Enregistrer</button>
                    <button type="button" className="civiq-btn civiq-btn-ghost" onClick={() => setEdition(null)} style={{ fontSize: 13 }}>Annuler</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 14 }}>{s.nom} <span style={{ color: "var(--fg-muted)", fontSize: 12.5 }}>· {libelleType(s.type)}</span></span>
                    <button type="button" className="civiq-btn civiq-btn-ghost" aria-label={`Renommer ${s.nom}`} onClick={() => { setEdition(s.id); setNomEdite(s.nom); }} style={{ padding: 8 }}><Pencil size={15} /></button>
                    <button type="button" className="civiq-btn civiq-btn-ghost" aria-label={`Retirer ${s.nom}`} disabled={occupe} onClick={() => supprimer(s)} style={{ padding: 8, color: "var(--destructive)" }}><Trash2 size={15} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(e) => { e.preventDefault(); if (nom.trim().length >= 2) ajouter(); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...champ, flex: "1 1 220px" }} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : École Jules-Ferry" maxLength={120} aria-label="Nom du nouveau lieu" />
          <select style={champ} value={type} onChange={(e) => setType(e.target.value as TypeSite)} aria-label="Type de lieu">
            {TYPES_SITE.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
          </select>
          <button type="submit" className="civiq-btn civiq-btn-default" disabled={occupe || nom.trim().length < 2} style={{ fontSize: 13 }}>
            {occupe ? <Loader2 size={14} className="civiq-spin" /> : <Plus size={14} />} Ajouter
          </button>
        </form>
      </div>

      <div>
        <label htmlFor="effacement-enfant" style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Effacer le prénom de l&apos;enfant</label>
        <select id="effacement-enfant" style={champ} value={effacement ?? ""} disabled={occupe}
          onChange={(e) => enregistrerEffacement(e.target.value ? Number(e.target.value) : null)}>
          <option value="">À la fin de l&apos;année scolaire (31 août)</option>
          <option value="3">3 mois après la clôture</option>
          <option value="6">6 mois après la clôture</option>
          <option value="12">12 mois après la clôture</option>
        </select>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
          Le reste du ticket est conservé. {effOk && <strong style={{ color: "var(--success)" }}>Enregistré.</strong>}
        </p>
      </div>
      {err && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--destructive)" }}>{err}</p>}
    </div>
  );
}
