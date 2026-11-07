"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import IconeCategorie, { NOMS_ICONES } from "./IconeCategorie";
import {
  URGENCES, URGENCE_LABELS, arborescence, formatDelai,
  type CategorieTicket, type NoeudCategorie,
} from "@/lib/tickets/categories";

// ═══════════════════════════════════════════════════════════════
// Catégories et sous-catégories de la commune (lot 2).
// Chaque niveau porte ses réglages ; une sous-catégorie sans réglage
// reprend ceux de sa catégorie.
// ═══════════════════════════════════════════════════════════════

const DELAIS: Array<{ h: number | null; l: string }> = [
  { h: null, l: "Aucun délai" }, { h: 1, l: "1 h" }, { h: 4, l: "4 h" }, { h: 24, l: "1 jour" },
  { h: 48, l: "2 jours" }, { h: 72, l: "3 jours" }, { h: 120, l: "5 jours" }, { h: 168, l: "1 semaine" },
  { h: 336, l: "2 semaines" }, { h: 720, l: "30 jours" },
];

const lab: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--fg)" };
const champ: React.CSSProperties = { height: 38, borderRadius: 8, border: "1px solid var(--border)", padding: "0 8px", font: "inherit", fontSize: 13.5, background: "var(--bg-card, #fff)", fontWeight: 400 };

async function appel(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Erreur");
  return j;
}

function Reglages({
  cat, services, estRacine, herite, onSaved,
}: {
  cat: CategorieTicket;
  services: Array<{ id: string; nom: string }>;
  estRacine: boolean;
  herite: string;
  onSaved: (c: CategorieTicket) => void;
}) {
  const [f, setF] = useState(cat);
  const [etat, setEtat] = useState<"repos" | "envoi" | "ok">("repos");
  const [err, setErr] = useState<string | null>(null);
  const maj = <K extends keyof CategorieTicket>(k: K, v: CategorieTicket[K]) => { setF((x) => ({ ...x, [k]: v })); setEtat("repos"); };
  const delaiConnu = DELAIS.some((d) => d.h === f.delai_cible_heures);

  async function enregistrer() {
    setErr(null); setEtat("envoi");
    try {
      const { categorie } = await appel(`/api/tickets/categories/${cat.id}`, "PATCH", {
        libelle: f.libelle, actif: f.actif, service_defaut_id: f.service_defaut_id, urgence_defaut: f.urgence_defaut,
        confidentialite_defaut: f.confidentialite_defaut, delai_cible_heures: f.delai_cible_heures,
        gestionnaire_externe: f.gestionnaire_externe ?? "", consigne_urgence: f.consigne_urgence ?? "",
        ...(estRacine ? { icone: f.icone } : {}),
      });
      onSaved(categorie); setEtat("ok");
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); setEtat("repos"); }
  }

  const vide = estRacine ? "Non défini" : herite;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, padding: "12px 14px", background: "var(--border-light)", borderRadius: 10 }}>
      <label style={lab}>Libellé<input style={champ} value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} maxLength={80} /></label>
      {estRacine && (
        <label style={lab}>Icône
          <select style={champ} value={f.icone ?? "circle-help"} onChange={(e) => maj("icone", e.target.value)}>
            {NOMS_ICONES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
      <label style={lab}>Service par défaut
        <select style={champ} value={f.service_defaut_id ?? ""} onChange={(e) => maj("service_defaut_id", e.target.value || null)}>
          <option value="">{vide}</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
      </label>
      <label style={lab}>Urgence proposée
        <select style={champ} value={f.urgence_defaut ?? ""} onChange={(e) => maj("urgence_defaut", (e.target.value || null) as CategorieTicket["urgence_defaut"])}>
          <option value="">{estRacine ? "Normale" : herite}</option>
          {URGENCES.map((u) => <option key={u} value={u}>{URGENCE_LABELS[u]}</option>)}
        </select>
      </label>
      <label style={lab}>Visibilité proposée
        <select style={champ} value={f.confidentialite_defaut ?? ""} onChange={(e) => maj("confidentialite_defaut", (e.target.value || null) as CategorieTicket["confidentialite_defaut"])}>
          <option value="">{estRacine ? "Standard" : herite}</option>
          <option value="standard">Standard</option>
          <option value="restreint">Restreint</option>
          <option value="confidentiel">Confidentiel</option>
        </select>
      </label>
      <label style={lab}>Délai cible
        <select style={champ} value={f.delai_cible_heures ?? ""} onChange={(e) => maj("delai_cible_heures", e.target.value ? Number(e.target.value) : null)}>
          {!estRacine && <option value="">{herite}</option>}
          {DELAIS.filter((d) => estRacine || d.h !== null).map((d) => <option key={d.l} value={d.h ?? ""}>{d.l}</option>)}
          {!delaiConnu && f.delai_cible_heures && <option value={f.delai_cible_heures}>{formatDelai(f.delai_cible_heures)}</option>}
        </select>
      </label>
      <label style={lab}>Gestionnaire extérieur suggéré<input style={champ} value={f.gestionnaire_externe ?? ""} onChange={(e) => maj("gestionnaire_externe", e.target.value)} placeholder={estRacine ? "Ex : Enedis" : herite} maxLength={120} /></label>
      <label style={{ ...lab, gridColumn: "1 / -1" }}>Consigne d&apos;urgence (affichée avant la création)
        <textarea style={{ ...champ, height: 64, padding: 8, resize: "vertical" }} value={f.consigne_urgence ?? ""} onChange={(e) => maj("consigne_urgence", e.target.value)} maxLength={1000} placeholder="Ex : ne pas allumer de flamme, appeler…" />
      </label>
      <label style={{ ...lab, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={f.actif} onChange={(e) => maj("actif", e.target.checked)} style={{ width: 18, height: 18 }} /> Proposée à la création
      </label>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="civiq-btn civiq-btn-default" onClick={enregistrer} disabled={etat === "envoi"} style={{ fontSize: 13 }}>
          {etat === "envoi" && <Loader2 size={14} className="civiq-spin" />} Enregistrer
        </button>
        {etat === "ok" && <span role="status" style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>Enregistré.</span>}
        {err && <span role="alert" style={{ fontSize: 13, color: "var(--destructive)" }}>{err}</span>}
      </div>
    </div>
  );
}

export default function CategoriesEditor({
  initial, services,
}: {
  initial: CategorieTicket[];
  services: Array<{ id: string; nom: string }>;
}) {
  const [cats, setCats] = useState(initial);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [reglage, setReglage] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState("");
  const [nouvelleSous, setNouvelleSous] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const arbre = arborescence(cats);

  const remplacer = (c: CategorieTicket) => setCats((xs) => xs.map((x) => (x.id === c.id ? c : x)));

  async function ajouter(libelle: string, parentId: string | null) {
    if (!libelle.trim()) return;
    setErr(null);
    try {
      const { categorie } = await appel("/api/tickets/categories", "POST", { libelle, parent_id: parentId });
      setCats((xs) => [...xs, categorie]);
      if (parentId) setNouvelleSous((m) => ({ ...m, [parentId]: "" })); else { setNouvelle(""); setOuverte(categorie.id); }
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
  }

  async function supprimer(c: CategorieTicket) {
    if (!window.confirm(`Supprimer « ${c.libelle} »${c.parent_id ? "" : " et ses sous-catégories"} ? Les tickets existants gardent leur historique.`)) return;
    setErr(null);
    try {
      await appel(`/api/tickets/categories/${c.id}`, "DELETE");
      setCats((xs) => xs.filter((x) => x.id !== c.id && x.parent_id !== c.id));
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
  }

  const resumer = (n: NoeudCategorie) => {
    const s = services.find((x) => x.id === n.service_defaut_id)?.nom;
    return [`${n.enfants.length} sous-catégorie${n.enfants.length > 1 ? "s" : ""}`, s ? `service : ${s}` : null, n.delai_cible_heures ? `délai ${formatDelai(n.delai_cible_heures)}` : null, n.actif ? null : "non proposée"].filter(Boolean).join(" · ");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {err && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--destructive)" }}>{err}</p>}
      {arbre.map((r) => {
        const estOuverte = ouverte === r.id;
        return (
          <div key={r.id} className="civiq-card" style={{ padding: 0, overflow: "hidden", opacity: r.actif ? 1 : 0.7 }}>
            <button
              type="button"
              aria-expanded={estOuverte}
              onClick={() => setOuverte(estOuverte ? null : r.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: 0, background: "transparent", cursor: "pointer", textAlign: "left", font: "inherit" }}
            >
              {estOuverte ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
              <IconeCategorie nom={r.icone} size={18} />
              <span style={{ fontWeight: 600, fontSize: 14.5, flex: 1 }}>{r.libelle}</span>
              <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{resumer(r)}</span>
            </button>
            {estOuverte && (
              <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="civiq-btn civiq-btn-outline" style={{ fontSize: 13 }} aria-expanded={reglage === r.id} onClick={() => setReglage(reglage === r.id ? null : r.id)}>
                    Réglages de la catégorie
                  </button>
                  {r.code !== "autre" && (
                    <button type="button" className="civiq-btn civiq-btn-ghost" style={{ fontSize: 13 }} onClick={() => supprimer(r)}>
                      <Trash2 size={14} aria-hidden="true" /> Supprimer
                    </button>
                  )}
                </div>
                {reglage === r.id && <Reglages cat={r} services={services} estRacine herite="" onSaved={remplacer} />}

                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {r.enfants.map((c) => (
                    <li key={c.id} style={{ borderTop: "1px solid var(--border-light)", paddingTop: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 13.5, color: c.actif ? "var(--fg)" : "var(--fg-muted)" }}>
                          {c.libelle}
                          {c.urgence_defaut && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--fg-muted)" }}>· {URGENCE_LABELS[c.urgence_defaut]}</span>}
                          {c.consigne_urgence && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--destructive)" }}>· consigne</span>}
                          {!c.actif && <span style={{ marginLeft: 8, fontSize: 12 }}>· non proposée</span>}
                        </span>
                        <button type="button" className="civiq-btn civiq-btn-ghost" style={{ fontSize: 12.5, padding: "4px 8px" }} aria-expanded={reglage === c.id} onClick={() => setReglage(reglage === c.id ? null : c.id)}>Réglages</button>
                        <button type="button" className="civiq-btn civiq-btn-ghost" style={{ padding: "4px 8px" }} aria-label={`Supprimer ${c.libelle}`} onClick={() => supprimer(c)}><Trash2 size={14} /></button>
                      </div>
                      {reglage === c.id && <Reglages cat={c} services={services} estRacine={false} herite={`Comme « ${r.libelle} »`} onSaved={remplacer} />}
                    </li>
                  ))}
                </ul>
                <form onSubmit={(e) => { e.preventDefault(); ajouter(nouvelleSous[r.id] ?? "", r.id); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ flex: "1 1 220px" }}>
                    <span className="tk-sr-only">Nouvelle sous-catégorie de {r.libelle}</span>
                    <input className="civiq-input" value={nouvelleSous[r.id] ?? ""} onChange={(e) => setNouvelleSous((m) => ({ ...m, [r.id]: e.target.value }))} placeholder="Nouvelle sous-catégorie" maxLength={80} />
                  </label>
                  <button type="submit" className="civiq-btn civiq-btn-outline" style={{ fontSize: 13 }} disabled={!(nouvelleSous[r.id] ?? "").trim()}><Plus size={14} /> Ajouter</button>
                </form>
              </div>
            )}
          </div>
        );
      })}
      <form onSubmit={(e) => { e.preventDefault(); ajouter(nouvelle, null); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <label style={{ flex: "1 1 240px" }}>
          <span className="tk-sr-only">Nouvelle catégorie</span>
          <input className="civiq-input" value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} placeholder="Nouvelle catégorie" maxLength={80} />
        </label>
        <button type="submit" className="civiq-btn civiq-btn-default" disabled={!nouvelle.trim()}><Plus size={14} /> Ajouter la catégorie</button>
      </form>
    </div>
  );
}
