"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2 } from "lucide-react";
import type { ProjectCompetence } from "@/lib/projects/types";

interface Profile { id: string; full_name: string | null; job_title: string | null; }

interface InitialValues {
  titre?: string;
  description?: string | null;
  objectifs?: string | null;
  competence?: ProjectCompetence;
  budget_estime?: number;
  sans_subvention?: boolean;
  pilote_elu?: string | null;
  pilote_agent?: string | null;
  taux_inflation?: number | null;
  taux_actualisation?: number | null;
  source_ticket_id?: string | null;
}

interface Props {
  mode: "create" | "edit";
  projectId?: string;            // requis en mode edit
  initial?: InitialValues;
  profilesDirectory: Profile[];
  /** En mode edit : ne pas afficher les champs source_ticket_id */
}

const COMPETENCES: ProjectCompetence[] = ["communale", "intercommunale", "a_verifier"];
const COMPETENCE_LABELS: Record<ProjectCompetence, string> = {
  communale: "Communale",
  intercommunale: "Intercommunale",
  a_verifier: "À vérifier",
};

// ═══════════════════════════════════════════════════════════════
// Formulaire création / édition projet (champs scalaires).
// ═══════════════════════════════════════════════════════════════

export default function ProjectForm({ mode, projectId, initial = {}, profilesDirectory }: Props) {
  const router = useRouter();

  const [titre, setTitre] = useState(initial.titre ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [objectifs, setObjectifs] = useState(initial.objectifs ?? "");
  const [competence, setCompetence] = useState<ProjectCompetence>(initial.competence ?? "a_verifier");
  const [budget, setBudget] = useState(initial.budget_estime != null ? String(initial.budget_estime) : "");
  const [sansSubv, setSansSubv] = useState(initial.sans_subvention ?? false);
  const [piloteElu, setPiloteElu] = useState(initial.pilote_elu ?? "");
  const [piloteAgent, setPiloteAgent] = useState(initial.pilote_agent ?? "");
  const [tauxInfl, setTauxInfl] = useState(initial.taux_inflation != null ? String(initial.taux_inflation) : "");
  const [tauxAct, setTauxAct] = useState(initial.taux_actualisation != null ? String(initial.taux_actualisation) : "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim()) return;
    setSaving(true);
    setError(null);

    const payload = {
      titre: titre.trim(),
      description: description.trim() || null,
      objectifs: objectifs.trim() || null,
      competence,
      budget_estime: budget ? Number(budget) : 0,
      sans_subvention: sansSubv,
      pilote_elu: piloteElu || null,
      pilote_agent: piloteAgent || null,
      taux_inflation: tauxInfl ? Number(tauxInfl) : null,
      taux_actualisation: tauxAct ? Number(tauxAct) : null,
      source_ticket_id: initial.source_ticket_id ?? null,
    };

    try {
      const url = mode === "create" ? "/api/projects" : `/api/projects/${projectId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { project?: { id: string }; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? `Erreur ${res.status}`);
        setSaving(false);
        return;
      }
      const targetId = data.project?.id ?? projectId;
      router.push(`/admin/projects/${targetId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
      setSaving(false);
    }
  }

  // Trie les profils utilisables : élus en haut, agents en bas
  const eluTitles = ["maire", "adjoint", "conseiller"];
  const agentTitles = ["dgs", "secretaire", "agent", "agent_technique"];
  const elus = profilesDirectory.filter((p) => p.job_title && eluTitles.includes(p.job_title));
  const agents = profilesDirectory.filter((p) => p.job_title && agentTitles.includes(p.job_title));

  return (
    <form onSubmit={submit} className="pj-form">
      <div className="civiq-card pj-section pj-section-wide">
        <h2 className="pj-section-title">Identité</h2>

        <div className="pj-form-grid">
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="titre">Titre *</label>
            <input
              id="titre"
              className="pj-input"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              required
            />
          </div>

          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="competence">Compétence</label>
            <select
              id="competence"
              className="pj-input"
              value={competence}
              onChange={(e) => setCompetence(e.target.value as ProjectCompetence)}
            >
              {COMPETENCES.map((c) => (
                <option key={c} value={c}>{COMPETENCE_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div className="pj-form-field pj-form-field-wide">
            <label className="civiq-field-label" htmlFor="description">Description courte</label>
            <textarea
              id="description"
              rows={2}
              className="pj-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="pj-form-field pj-form-field-wide">
            <label className="civiq-field-label" htmlFor="objectifs">Objectifs</label>
            <textarea
              id="objectifs"
              rows={3}
              className="pj-input"
              value={objectifs}
              onChange={(e) => setObjectifs(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="civiq-card pj-section">
        <h2 className="pj-section-title">Pilotes</h2>
        <div className="pj-form-grid">
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="pilote_elu">Pilote élu</label>
            <select
              id="pilote_elu"
              className="pj-input"
              value={piloteElu}
              onChange={(e) => setPiloteElu(e.target.value)}
            >
              <option value="">— Aucun —</option>
              {elus.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
              ))}
            </select>
          </div>
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="pilote_agent">Pilote agent</label>
            <select
              id="pilote_agent"
              className="pj-input"
              value={piloteAgent}
              onChange={(e) => setPiloteAgent(e.target.value)}
            >
              <option value="">— Aucun —</option>
              {agents.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="pj-section-empty">
          Les pilotes sélectionnés seront automatiquement abonnés aux notifications.
        </p>
      </div>

      <div className="civiq-card pj-section">
        <h2 className="pj-section-title">Budget et financement</h2>
        <div className="pj-form-grid">
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="budget">Budget estimé (€)</label>
            <input
              id="budget"
              type="number"
              className="pj-input"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <div className="pj-form-field pj-form-field-checkbox">
            <label className="pj-checkbox">
              <input
                type="checkbox"
                checked={sansSubv}
                onChange={(e) => setSansSubv(e.target.checked)}
              />
              <span>Sans subvention (autofinancement assumé)</span>
            </label>
            <p className="pj-section-empty">
              Cochez si la commune assume entièrement le projet. Permet de
              franchir la porte de financement sans subvention.
            </p>
          </div>
        </div>
      </div>

      <div className="civiq-card pj-section">
        <h2 className="pj-section-title">Taux d&apos;actualisation (override projet)</h2>
        <div className="pj-form-grid">
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="ti">Taux inflation (%) — vide = commune</label>
            <input
              id="ti"
              type="number"
              step="0.1"
              className="pj-input"
              value={tauxInfl}
              onChange={(e) => setTauxInfl(e.target.value)}
              placeholder="ex: 2.5"
            />
          </div>
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="ta">Taux actualisation (%) — vide = commune</label>
            <input
              id="ta"
              type="number"
              step="0.1"
              className="pj-input"
              value={tauxAct}
              onChange={(e) => setTauxAct(e.target.value)}
              placeholder="ex: 4"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="pj-modal-error">
          {error}
        </div>
      )}

      <div className="pj-form-actions">
        <button
          type="submit"
          disabled={saving || !titre.trim()}
          className="civiq-btn civiq-btn-default"
        >
          {saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
          {mode === "create" ? "Créer le projet" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
