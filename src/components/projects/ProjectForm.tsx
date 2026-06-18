"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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
  projectId?: string;
  initial?: InitialValues;
  profilesDirectory: Profile[];
}

const COMPETENCES: ProjectCompetence[] = ["communale", "intercommunale", "a_verifier"];
const COMPETENCE_LABELS: Record<ProjectCompetence, string> = {
  communale: "Communale",
  intercommunale: "Intercommunale",
  a_verifier: "À vérifier",
};

// ═══════════════════════════════════════════════════════════════
// ProjectForm — version « wizard » sur mobile (une carte par
// étape), version pleine page sur desktop. La même donnée, deux
// présentations selon la largeur d'écran.
//
// Étapes wizard (mobile) :
//   1. Identité (titre, compétence)
//   2. Présentation (description, objectifs)
//   3. Pilotes (élu, agent)
//   4. Budget (montant, sans subvention)
//   5. Taux d'actualisation (override)
//   6. Validation (récap + bouton créer/enregistrer)
// ═══════════════════════════════════════════════════════════════

const WIZARD_STEPS = [
  { key: "identite", label: "Identité", icon: "📛" },
  { key: "presentation", label: "Présentation", icon: "📝" },
  { key: "pilotes", label: "Pilotes", icon: "👥" },
  { key: "budget", label: "Budget", icon: "💰" },
  { key: "taux", label: "Taux", icon: "📊" },
  { key: "validation", label: "Validation", icon: "✅" },
];

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

  // Détection mobile via media query
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const [step, setStep] = useState(0);

  async function submit() {
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

  const eluTitles = ["maire", "adjoint", "conseiller"];
  const agentTitles = ["dgs", "secretaire", "agent", "agent_technique"];
  const elus = profilesDirectory.filter((p) => p.job_title && eluTitles.includes(p.job_title));
  const agents = profilesDirectory.filter((p) => p.job_title && agentTitles.includes(p.job_title));

  // ─── Vue mobile : wizard une étape par écran ───
  if (isMobile) {
    const totalSteps = WIZARD_STEPS.length;
    const currentStep = WIZARD_STEPS[step];
    const isLast = step === totalSteps - 1;
    const canNext = step < totalSteps - 1;
    const canBack = step > 0;

    // Validation simple par étape
    const isStepValid = () => {
      if (step === 0) return titre.trim().length > 0;
      return true;
    };

    return (
      <div className="pj-wizard">
        <div className="pj-wizard-progress" aria-hidden>
          <div
            className="pj-wizard-progress-fill"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <div className="pj-wizard-step-meta">
          <span className="pj-wizard-step-num">Étape {step + 1} / {totalSteps}</span>
          <span className="pj-wizard-step-label">
            {currentStep.icon} {currentStep.label}
          </span>
        </div>

        <div className="civiq-card pj-wizard-card">
          {step === 0 && (
            <>
              <h2 className="pj-wizard-question">Comment s&apos;appelle votre projet ?</h2>
              <label className="civiq-field-label" htmlFor="w-titre">Titre du projet *</label>
              <input
                id="w-titre"
                className="pj-input"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex : Réfection de la rue de l'Église"
                autoFocus
              />
              <label className="civiq-field-label" htmlFor="w-comp" style={{ marginTop: 16 }}>
                Compétence
              </label>
              <select
                id="w-comp"
                className="pj-input"
                value={competence}
                onChange={(e) => setCompetence(e.target.value as ProjectCompetence)}
              >
                {COMPETENCES.map((c) => (
                  <option key={c} value={c}>{COMPETENCE_LABELS[c]}</option>
                ))}
              </select>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="pj-wizard-question">Décrivez le projet</h2>
              <label className="civiq-field-label" htmlFor="w-desc">Description courte</label>
              <textarea
                id="w-desc"
                rows={2}
                className="pj-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="En une phrase, de quoi s'agit-il ?"
              />
              <label className="civiq-field-label" htmlFor="w-obj" style={{ marginTop: 12 }}>
                Objectifs
              </label>
              <textarea
                id="w-obj"
                rows={4}
                className="pj-input"
                value={objectifs}
                onChange={(e) => setObjectifs(e.target.value)}
                placeholder="Quels résultats attendez-vous ?"
              />
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="pj-wizard-question">Qui pilote ce projet ?</h2>
              <p className="pj-wizard-hint">Les pilotes seront automatiquement abonnés aux notifications.</p>
              <label className="civiq-field-label" htmlFor="w-elu">Pilote élu</label>
              <select
                id="w-elu"
                className="pj-input"
                value={piloteElu}
                onChange={(e) => setPiloteElu(e.target.value)}
              >
                <option value="">— Aucun —</option>
                {elus.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
                ))}
              </select>
              <label className="civiq-field-label" htmlFor="w-ag" style={{ marginTop: 12 }}>Pilote agent</label>
              <select
                id="w-ag"
                className="pj-input"
                value={piloteAgent}
                onChange={(e) => setPiloteAgent(e.target.value)}
              >
                <option value="">— Aucun —</option>
                {agents.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
                ))}
              </select>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="pj-wizard-question">Quel budget prévoyez-vous ?</h2>
              <label className="civiq-field-label" htmlFor="w-bud">Budget estimé (€)</label>
              <input
                id="w-bud"
                type="number"
                className="pj-input"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                inputMode="numeric"
                placeholder="150000"
              />
              <label className="pj-checkbox" style={{ marginTop: 16 }}>
                <input
                  type="checkbox"
                  checked={sansSubv}
                  onChange={(e) => setSansSubv(e.target.checked)}
                />
                <span>Sans subvention (autofinancement)</span>
              </label>
              <p className="pj-wizard-hint">
                Cochez si la commune assume entièrement le projet. La porte de
                financement sera franchie sans subvention.
              </p>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="pj-wizard-question">Personnaliser les taux ?</h2>
              <p className="pj-wizard-hint">
                Laissez vide pour utiliser les taux par défaut de la commune.
              </p>
              <label className="civiq-field-label" htmlFor="w-infl">Taux inflation (%)</label>
              <input
                id="w-infl"
                type="number"
                step="0.1"
                className="pj-input"
                value={tauxInfl}
                onChange={(e) => setTauxInfl(e.target.value)}
                inputMode="decimal"
                placeholder="ex : 2.5"
              />
              <label className="civiq-field-label" htmlFor="w-act" style={{ marginTop: 12 }}>
                Taux actualisation (%)
              </label>
              <input
                id="w-act"
                type="number"
                step="0.1"
                className="pj-input"
                value={tauxAct}
                onChange={(e) => setTauxAct(e.target.value)}
                inputMode="decimal"
                placeholder="ex : 4"
              />
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="pj-wizard-question">Récapitulatif</h2>
              <dl className="pj-wizard-recap">
                <div><dt>Titre</dt><dd>{titre || <em>vide</em>}</dd></div>
                <div><dt>Compétence</dt><dd>{COMPETENCE_LABELS[competence]}</dd></div>
                {description && <div><dt>Description</dt><dd>{description}</dd></div>}
                {objectifs && <div><dt>Objectifs</dt><dd>{objectifs}</dd></div>}
                <div><dt>Pilote élu</dt><dd>{elus.find((e) => e.id === piloteElu)?.full_name ?? "—"}</dd></div>
                <div><dt>Pilote agent</dt><dd>{agents.find((a) => a.id === piloteAgent)?.full_name ?? "—"}</dd></div>
                <div><dt>Budget</dt><dd>{budget ? `${budget} €` : "—"}</dd></div>
                <div><dt>Subvention</dt><dd>{sansSubv ? "Autofinancement" : "À solliciter"}</dd></div>
              </dl>
              {error && <div className="pj-modal-error">{error}</div>}
            </>
          )}
        </div>

        <div className="pj-wizard-actions">
          {canBack && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="civiq-btn civiq-btn-ghost"
              disabled={saving}
            >
              <ChevronLeft size={14} /> Retour
            </button>
          )}
          {!isLast && (
            <button
              type="button"
              onClick={() => canNext && setStep(step + 1)}
              disabled={!isStepValid()}
              className="civiq-btn civiq-btn-default"
              style={{ marginLeft: "auto" }}
            >
              Suivant <ChevronRight size={14} />
            </button>
          )}
          {isLast && (
            <button
              type="button"
              onClick={submit}
              disabled={saving || !titre.trim()}
              className="civiq-btn civiq-btn-default"
              style={{ marginLeft: "auto" }}
            >
              {saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
              {mode === "create" ? "Créer le projet" : "Enregistrer"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Vue desktop : pleine page ───
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="pj-form">
      <div className="civiq-card pj-section pj-section-wide">
        <h2 className="pj-section-title">Identité</h2>
        <div className="pj-form-grid">
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="titre">Titre *</label>
            <input id="titre" className="pj-input" value={titre} onChange={(e) => setTitre(e.target.value)} required />
          </div>
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="competence">Compétence</label>
            <select id="competence" className="pj-input" value={competence} onChange={(e) => setCompetence(e.target.value as ProjectCompetence)}>
              {COMPETENCES.map((c) => <option key={c} value={c}>{COMPETENCE_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="pj-form-field pj-form-field-wide">
            <label className="civiq-field-label" htmlFor="description">Description courte</label>
            <textarea id="description" rows={2} className="pj-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="pj-form-field pj-form-field-wide">
            <label className="civiq-field-label" htmlFor="objectifs">Objectifs</label>
            <textarea id="objectifs" rows={3} className="pj-input" value={objectifs} onChange={(e) => setObjectifs(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="civiq-card pj-section">
        <h2 className="pj-section-title">Pilotes</h2>
        <div className="pj-form-grid">
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="pilote_elu">Pilote élu</label>
            <select id="pilote_elu" className="pj-input" value={piloteElu} onChange={(e) => setPiloteElu(e.target.value)}>
              <option value="">— Aucun —</option>
              {elus.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>)}
            </select>
          </div>
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="pilote_agent">Pilote agent</label>
            <select id="pilote_agent" className="pj-input" value={piloteAgent} onChange={(e) => setPiloteAgent(e.target.value)}>
              <option value="">— Aucun —</option>
              {agents.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>)}
            </select>
          </div>
        </div>
        <p className="pj-section-empty">Les pilotes sélectionnés seront automatiquement abonnés aux notifications.</p>
      </div>

      <div className="civiq-card pj-section">
        <h2 className="pj-section-title">Budget et financement</h2>
        <div className="pj-form-grid">
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="budget">Budget estimé (€)</label>
            <input id="budget" type="number" className="pj-input" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <div className="pj-form-field pj-form-field-checkbox">
            <label className="pj-checkbox">
              <input type="checkbox" checked={sansSubv} onChange={(e) => setSansSubv(e.target.checked)} />
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
            <input id="ti" type="number" step="0.1" className="pj-input" value={tauxInfl} onChange={(e) => setTauxInfl(e.target.value)} placeholder="ex: 2.5" />
          </div>
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="ta">Taux actualisation (%) — vide = commune</label>
            <input id="ta" type="number" step="0.1" className="pj-input" value={tauxAct} onChange={(e) => setTauxAct(e.target.value)} placeholder="ex: 4" />
          </div>
        </div>
      </div>

      {error && <div className="pj-modal-error">{error}</div>}

      <div className="pj-form-actions">
        <button type="submit" disabled={saving || !titre.trim()} className="civiq-btn civiq-btn-default">
          {saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
          {mode === "create" ? "Créer le projet" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
