"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_TYPE_LABELS,
  type ProjectStakeholder,
  type Stakeholder,
  type StakeholderRole,
  type StakeholderType,
} from "@/lib/projects/types";
import FieldHelp from "./FieldHelp";

// ═══════════════════════════════════════════════════════════════
// Parties prenantes d'un projet (onglet « Partenaires » d'un événement).
// L'annuaire est unique (table contacts) : on filtre par catégorie pour
// ne pas noyer l'utilisateur sous tous les contacts de la commune.
// ═══════════════════════════════════════════════════════════════

type Row = ProjectStakeholder & { stakeholder: Stakeholder | null };

interface Props {
  projectId: string;
  initial: Row[];
  directory: Stakeholder[];
  canEdit: boolean;
  /** Catégorie présélectionnée du filtre (ex. « citoyenne » pour les associations). */
  defaultCategorie?: StakeholderType | "";
  title?: string;
}

const CATEGORIES = Object.keys(STAKEHOLDER_TYPE_LABELS) as StakeholderType[];
const ROLES = Object.keys(STAKEHOLDER_ROLE_LABELS) as StakeholderRole[];

export default function PartiesPrenantesEditor({
  projectId, initial, directory, canEdit, defaultCategorie = "", title = "Parties prenantes",
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [annuaire, setAnnuaire] = useState<Stakeholder[]>(directory);
  const [categorie, setCategorie] = useState<StakeholderType | "">(defaultCategorie);
  const [contactId, setContactId] = useState("");
  const [role, setRole] = useState<StakeholderRole>("consulte");
  const [mode, setMode] = useState<"annuaire" | "nouveau">("annuaire");
  const [nouveau, setNouveau] = useState({ nom: "", organisation: "", email: "", telephone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dejaLies = new Set(rows.map((r) => r.stakeholder_id));
  const filtres = annuaire.filter((c) => !dejaLies.has(c.id) && (!categorie || c.type === categorie));

  async function link(id: string) {
    const res = await fetch(`/api/projects/${projectId}/stakeholders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stakeholder_id: id, role, phase: null }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.project_stakeholder) throw new Error(json.error ?? "L'ajout a échoué.");
    setRows((r) => [...r, json.project_stakeholder as Row]);
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "annuaire") {
        if (!contactId) throw new Error("Choisissez un contact dans la liste.");
        await link(contactId);
        setContactId("");
      } else {
        if (!nouveau.nom.trim()) throw new Error("Indiquez au moins le nom.");
        const res = await fetch("/api/stakeholders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...nouveau, type: categorie || "institutionnelle" }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.stakeholder) throw new Error(json.error ?? "Le contact n'a pas été créé.");
        setAnnuaire((a) => [...a, json.stakeholder as Stakeholder]);
        await link((json.stakeholder as Stakeholder).id);
        setNouveau({ nom: "", organisation: "", email: "", telephone: "" });
        setMode("annuaire");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'ajout a échoué.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink(r: Row) {
    const before = rows;
    setRows((l) => l.filter((x) => x.id !== r.id));
    const res = await fetch(`/api/projects/${projectId}/stakeholders/${r.id}`, { method: "DELETE" });
    if (!res.ok) { setRows(before); setError("Le retrait a échoué."); }
    else router.refresh();
  }

  return (
    <section className="pj-pp" aria-labelledby="pp-titre">
      <h2 id="pp-titre" className="pj-section-title">{title}<span className="pj-section-count">{rows.length}</span></h2>
      {error && <p className="pj-modal-error" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <p className="pj-section-empty">Personne n&apos;est encore associé à ce projet.</p>
      ) : (
        <ul className="pj-pp-list">
          {rows.map((r) => (
            <li key={r.id} className="pj-pp-item">
              <div>
                <p className="pj-pp-nom">{r.stakeholder?.nom ?? "Contact supprimé"}{r.stakeholder?.organisation ? ` — ${r.stakeholder.organisation}` : ""}</p>
                <p className="pj-pp-meta">
                  {STAKEHOLDER_ROLE_LABELS[r.role]}
                  {r.stakeholder?.type ? ` · ${STAKEHOLDER_TYPE_LABELS[r.stakeholder.type]}` : ""}
                  {r.stakeholder?.email ? <> · <a href={`mailto:${r.stakeholder.email}`}>{r.stakeholder.email}</a></> : null}
                  {r.stakeholder?.telephone ? ` · ${r.stakeholder.telephone}` : ""}
                </p>
              </div>
              {canEdit && (
                <button type="button" className="civiq-icon-btn danger" onClick={() => unlink(r)} aria-label={`Retirer ${r.stakeholder?.nom ?? "ce contact"} du projet`}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form className="pj-pp-add" onSubmit={submit}>
          <div className="pj-pp-add-head">
            <div className="civiq-field">
              <label htmlFor="pp-cat" className="civiq-field-label">Catégorie</label>
              <select id="pp-cat" className="civiq-select" value={categorie} onChange={(e) => { setCategorie(e.target.value as StakeholderType | ""); setContactId(""); }}>
                <option value="">Toutes les catégories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{STAKEHOLDER_TYPE_LABELS[c]}</option>)}
              </select>
            </div>
            <div className="civiq-field">
              <label htmlFor="pp-role" className="civiq-field-label">Son rôle dans le projet</label>
              <select id="pp-role" className="civiq-select" value={role} onChange={(e) => setRole(e.target.value as StakeholderRole)}>
                {ROLES.map((r) => <option key={r} value={r}>{STAKEHOLDER_ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <FieldHelp id="pp-role">
            <p>« Décide » : valide les choix. « Exécute » : réalise le travail. « Consulté » : donne son avis. « Informé » : est tenu au courant.</p>
          </FieldHelp>

          <div className="pj-deliv-segment" role="group" aria-label="Origine du contact">
            <button type="button" aria-pressed={mode === "annuaire"} className={mode === "annuaire" ? "is-active" : ""} onClick={() => setMode("annuaire")}>Dans l&apos;annuaire</button>
            <button type="button" aria-pressed={mode === "nouveau"} className={mode === "nouveau" ? "is-active" : ""} onClick={() => setMode("nouveau")}>Nouveau contact</button>
          </div>

          {mode === "annuaire" ? (
            <div className="civiq-field">
              <label htmlFor="pp-contact" className="civiq-field-label">Contact</label>
              <select id="pp-contact" className="civiq-select" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">{filtres.length ? "Choisir…" : "Aucun contact dans cette catégorie"}</option>
                {filtres.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.organisation ? ` (${c.organisation})` : ""}</option>)}
              </select>
            </div>
          ) : (
            <div className="pj-params-grid">
              {(["nom", "organisation", "email", "telephone"] as const).map((k) => (
                <div key={k} className="civiq-field">
                  <label htmlFor={`pp-${k}`} className="civiq-field-label">
                    {{ nom: "Nom", organisation: "Organisation", email: "Email", telephone: "Téléphone" }[k]}
                    {k === "nom" ? <span className="civiq-required" aria-hidden="true"> *</span> : null}
                  </label>
                  <input id={`pp-${k}`} className="civiq-input" type={k === "email" ? "email" : k === "telephone" ? "tel" : "text"}
                    value={nouveau[k]} onChange={(e) => setNouveau((n) => ({ ...n, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
          <button type="submit" className="civiq-btn civiq-btn-default" disabled={busy}>
            {busy ? <Loader2 size={16} className="civiq-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} Ajouter au projet
          </button>
        </form>
      )}
    </section>
  );
}
