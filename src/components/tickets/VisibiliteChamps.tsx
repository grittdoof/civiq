"use client";

import { useMemo, useState } from "react";
import { Lock, Search, Users } from "lucide-react";
import { CONFIDENTIALITE_AIDE, CONFIDENTIALITE_LABELS, type Confidentialite } from "@/lib/tickets/droits";
import { FONCTION_LABEL } from "@/lib/profils/fonctions";

// ═══════════════════════════════════════════════════════════════
// Choix du niveau de visibilité d'un signalement et de ses
// destinataires nommés (lot 1). Contrôlé : utilisé à la création
// et sur la fiche. Restreint / confidentiel → au moins une personne.
// ═══════════════════════════════════════════════════════════════

export interface Personne { id: string; full_name: string | null; job_title: string | null }

const NIVEAUX: Confidentialite[] = ["standard", "restreint", "confidentiel"];

export default function VisibiliteChamps({
  niveau, destinataires, personnes, moi, onNiveau, onDestinataires, nom = "visibilite",
}: {
  niveau: Confidentialite;
  destinataires: string[];
  personnes: Personne[];
  /** L'utilisateur courant (créateur) : inutile de se choisir soi-même. */
  moi?: string;
  onNiveau: (n: Confidentialite) => void;
  onDestinataires: (ids: string[]) => void;
  nom?: string;
}) {
  const [filtre, setFiltre] = useState("");
  const choisissables = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return personnes
      .filter((p) => p.id !== moi)
      .filter((p) => !f || (p.full_name ?? "").toLowerCase().includes(f) || (FONCTION_LABEL[p.job_title ?? ""] ?? "").toLowerCase().includes(f));
  }, [personnes, moi, filtre]);

  function basculer(id: string) {
    onDestinataires(destinataires.includes(id) ? destinataires.filter((x) => x !== id) : [...destinataires, id]);
  }

  const manque = niveau !== "standard" && destinataires.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--fg)" }}>Qui peut voir ce signalement ?</legend>
        {NIVEAUX.map((n) => {
          const actif = niveau === n;
          return (
            <label
              key={n}
              style={{
                display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", cursor: "pointer",
                borderRadius: "var(--radius)", border: `${actif ? 2 : 1}px solid ${actif ? "var(--accent)" : "var(--border)"}`,
                background: actif ? "var(--accent-light)" : "var(--bg-card, #fff)",
              }}
            >
              <input type="radio" name={nom} value={n} checked={actif} onChange={() => onNiveau(n)} style={{ marginTop: 3, width: 18, height: 18 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {n !== "standard" && <Lock size={13} aria-hidden="true" />}
                  {CONFIDENTIALITE_LABELS[n]}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{CONFIDENTIALITE_AIDE[n]}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {niveau !== "standard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <Users size={14} aria-hidden="true" /> Personnes choisies ({destinataires.length})
          </p>
          {personnes.length > 8 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0 10px", height: 40 }}>
              <Search size={14} aria-hidden="true" style={{ color: "var(--fg-muted)" }} />
              <span className="tk-sr-only">Rechercher une personne</span>
              <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher une personne…" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, font: "inherit", fontSize: 14, background: "transparent" }} />
            </label>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 240, overflowY: "auto" }}>
            {choisissables.map((p) => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderRadius: 8, cursor: "pointer", minHeight: 40 }}>
                <input type="checkbox" checked={destinataires.includes(p.id)} onChange={() => basculer(p.id)} style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 14 }}>{p.full_name ?? "Sans nom"}</span>
                {p.job_title && <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{FONCTION_LABEL[p.job_title] ?? p.job_title}</span>}
              </label>
            ))}
            {choisissables.length === 0 && <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0 }}>Aucune personne trouvée.</p>}
          </div>
          {manque && (
            <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "var(--destructive)" }}>
              Choisissez au moins une personne : sinon, personne d&apos;autre que vous ne verrait ce signalement.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
