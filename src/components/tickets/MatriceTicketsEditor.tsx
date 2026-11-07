"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import {
  ACTIONS, FONCTIONS_MATRICE, PORTEES,
  type Action, type LigneMatrice, type Portee, type ValeurAction,
} from "@/lib/tickets/droits";

// ═══════════════════════════════════════════════════════════════
// Matrice fonction × action du module Tickets d'une commune (lot 1).
// Écran super-admin (fiche commune). Le tableau défile
// horizontalement dans son cadre sur petit écran.
// ═══════════════════════════════════════════════════════════════

const th: React.CSSProperties = { padding: "10px 8px", fontSize: 11.5, fontWeight: 700, textAlign: "left", color: "var(--fg-muted)", borderBottom: "2px solid var(--border)", whiteSpace: "nowrap", background: "var(--bg-card, #fff)" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid var(--border-light)", whiteSpace: "nowrap" };
const sel: React.CSSProperties = { height: 34, borderRadius: 8, border: "1px solid var(--border)", padding: "0 6px", font: "inherit", fontSize: 12.5, background: "var(--bg-card, #fff)" };

const LIB_FONCTION = Object.fromEntries(FONCTIONS_MATRICE.map((f) => [f.fonction, f.libelle]));

export default function MatriceTicketsEditor({ communeId }: { communeId: string }) {
  const [lignes, setLignes] = useState<LigneMatrice[] | null>(null);
  const [defaut, setDefaut] = useState<LigneMatrice[]>([]);
  const [modifie, setModifie] = useState(false);
  const [etat, setEtat] = useState<"repos" | "enregistrement" | "ok">("repos");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/super-admin/communes/${communeId}/tickets-matrice`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Matrice indisponible");
        setLignes(j.lignes); setDefaut(j.defaut);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erreur"));
  }, [communeId]);

  function maj(i: number, f: (l: LigneMatrice) => LigneMatrice) {
    setLignes((ls) => ls ? ls.map((l, j) => (j === i ? f(l) : l)) : ls);
    setModifie(true); setEtat("repos");
  }

  async function enregistrer() {
    if (!lignes) return;
    setErr(null); setEtat("enregistrement");
    const r = await fetch(`/api/super-admin/communes/${communeId}/tickets-matrice`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lignes }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "Enregistrement impossible"); setEtat("repos"); return; }
    setModifie(false); setEtat("ok");
  }

  if (err && !lignes) return <p role="alert" style={{ color: "var(--destructive)", fontSize: 13 }}>{err}</p>;
  if (!lignes) return <p style={{ fontSize: 13, color: "var(--fg-muted)" }}><Loader2 size={14} className="civiq-spin" /> Chargement…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 1100 }}>
          <caption className="tk-sr-only">Droits sur les tickets par fonction</caption>
          <thead>
            <tr>
              <th scope="col" style={{ ...th, position: "sticky", left: 0, zIndex: 1 }}>Fonction</th>
              <th scope="col" style={th}>Voit</th>
              <th scope="col" style={th}>Restreints</th>
              {ACTIONS.map((a) => <th key={a.action} scope="col" style={th}>{a.libelle}</th>)}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={l.fonction}>
                <th scope="row" style={{ ...td, fontWeight: 600, textAlign: "left", position: "sticky", left: 0, background: "var(--bg-card, #fff)" }}>
                  {LIB_FONCTION[l.fonction]}
                </th>
                <td style={td}>
                  <select aria-label={`${LIB_FONCTION[l.fonction]} : voit`} style={sel} value={l.voit}
                    onChange={(e) => maj(i, (x) => ({ ...x, voit: e.target.value as Portee }))}>
                    {PORTEES.map((p) => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}
                  </select>
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <input type="checkbox" aria-label={`${LIB_FONCTION[l.fonction]} : voit les restreints`}
                    checked={l.voit_restreints} style={{ width: 18, height: 18 }}
                    onChange={(e) => maj(i, (x) => ({ ...x, voit_restreints: e.target.checked }))} />
                </td>
                {ACTIONS.map((a) => (
                  <td key={a.action} style={td}>
                    <select aria-label={`${LIB_FONCTION[l.fonction]} : ${a.libelle}`} style={{ ...sel, color: l.actions[a.action] === "non" ? "var(--fg-muted)" : "var(--fg)" }}
                      value={l.actions[a.action]}
                      onChange={(e) => maj(i, (x) => ({ ...x, actions: { ...x.actions, [a.action as Action]: e.target.value as ValeurAction } }))}>
                      <option value="oui">Oui</option>
                      <option value="non">Non</option>
                      {a.siAssignePossible && <option value="si_assigne">Si assigné</option>}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.55 }}>
        <strong>Voit</strong> : rien · ses tickets (créés, assignés ou dont il est destinataire) · son service · toute la commune.
        Le créateur, les assignés et les destinataires voient toujours leurs tickets, sauf si la fonction est réglée sur « rien ».
        Un ticket <strong>confidentiel</strong> n&apos;est visible que de son créateur, de ses destinataires et du super-admin.
        « Si assigné » : seulement sur les tickets assignés à la personne (pour « Assigner » : prendre en charge, s&apos;ajouter soi-même).
        L&apos;accès au module reste décidé utilisateur par utilisateur.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="civiq-btn civiq-btn-default" onClick={enregistrer} disabled={!modifie || etat === "enregistrement"}>
          {etat === "enregistrement" ? <Loader2 size={14} className="civiq-spin" /> : <Save size={14} />} Enregistrer la matrice
        </button>
        <button type="button" className="civiq-btn civiq-btn-outline"
          onClick={() => { setLignes(defaut.map((d) => ({ ...d, actions: { ...d.actions } }))); setModifie(true); setEtat("repos"); }}>
          <RotateCcw size={14} /> Matrice par défaut
        </button>
        {etat === "ok" && <span role="status" style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>Matrice enregistrée.</span>}
        {modifie && etat === "repos" && <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>Modifications non enregistrées</span>}
        {err && <span role="alert" style={{ fontSize: 13, color: "var(--destructive)" }}>{err}</span>}
      </div>
    </div>
  );
}
