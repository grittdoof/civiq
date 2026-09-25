"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, RotateCcw } from "lucide-react";
import type { Stakeholder, TypeProjetCode } from "@/lib/projects/types";
import {
  FOURCHETTES,
  encartMarchesPublics,
  formatOffset,
  proposerJalons,
  validateWizard,
  type Fourchette,
  type JalonModele,
  type JalonPropose,
} from "@/lib/projects/wizard";
import { formatEtapeDate } from "@/lib/projects/etapes";
import { TYPE_META } from "./TypeBadge";
import FieldHelp from "./FieldHelp";
import LearnMore from "./LearnMore";

// ═══════════════════════════════════════════════════════════════
// Assistant de création d'un projet (brief §2.2 – 2.3).
// Une question par écran, retour toujours possible, brouillon
// sauvegardé dans le navigateur à chaque saisie.
// ═══════════════════════════════════════════════════════════════

export interface WizardTypeRow {
  code: TypeProjetCode;
  libelle: string;
  accroche: string;
  exemples: string[];
  jalons_modele: JalonModele[];
}

export interface WizardPerson { id: string; full_name: string | null; job_title: string | null }
export interface WizardCommission { id: string; nom: string; color: string }

interface Props {
  types: WizardTypeRow[];
  commissions: WizardCommission[];
  people: WizardPerson[];
  associations: Stakeholder[];
  prefill?: { titre?: string; description?: string; source_ticket_id?: string; commission_pilote_id?: string; type_code?: TypeProjetCode };
  currentUserId: string;
}

type Step = "type" | "suivi" | "quoi" | "qui" | "combien" | "quand" | "quand_ou" | "recap";

const STEPS: Record<TypeProjetCode, Step[]> = {
  suivi_simple: ["type", "suivi"],
  investissement: ["type", "quoi", "qui", "combien", "quand", "recap"],
  evenementiel: ["type", "quoi", "quand_ou", "qui", "recap"],
};

interface Draft {
  type_code: TypeProjetCode | null;
  titre: string;
  description: string;
  commission_pilote_id: string;
  commissions_associees: string[];
  elu_referent_id: string;
  agent_pilote_id: string;
  contributeurs: string[];
  fourchette_estimation: Fourchette | null;
  echeance_souhaitee: string;
  sans_echeance: boolean;
  evenement_date: string;
  evenement_heure_debut: string;
  evenement_heure_fin: string;
  lieu: string;
  jauge: string;
  partenaires: string[];
  /** Jalons décochés, par libellé. */
  jalons_retires: string[];
  /** Jalons conditionnels cochés, par libellé. */
  jalons_ajoutes: string[];
  source_ticket_id: string;
}

const DRAFT_KEY = "civiq:projet-brouillon";
const ELU_TITLES = ["maire", "adjoint", "conseiller"];
const AGENT_TITLES = ["dgs", "secretaire", "agent", "agent_technique"];

function emptyDraft(prefill?: Props["prefill"]): Draft {
  return {
    type_code: prefill?.type_code ?? null,
    titre: prefill?.titre ?? "",
    description: prefill?.description ?? "",
    commission_pilote_id: prefill?.commission_pilote_id ?? "",
    commissions_associees: [],
    elu_referent_id: "",
    agent_pilote_id: "",
    contributeurs: [],
    fourchette_estimation: null,
    echeance_souhaitee: "",
    sans_echeance: false,
    evenement_date: "",
    evenement_heure_debut: "",
    evenement_heure_fin: "",
    lieu: "",
    jauge: "",
    partenaires: [],
    jalons_retires: [],
    jalons_ajoutes: [],
    source_ticket_id: prefill?.source_ticket_id ?? "",
  };
}

const personLabel = (p: WizardPerson) => p.full_name?.trim() || "Sans nom";

export default function ProjectWizard({ types, commissions, people, associations, prefill, currentUserId }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(prefill));
  const [step, setStep] = useState<Step>(prefill?.type_code ? STEPS[prefill.type_code][1] : "type");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [partners, setPartners] = useState<Stakeholder[]>(associations);
  const [newPartner, setNewPartner] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // ─── Brouillon : restauration (sauf création depuis un ticket) puis sauvegarde ───
  useEffect(() => {
    if (prefill?.source_ticket_id) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { owner: string; draft: Draft; step: Step };
      if (saved.owner !== currentUserId || !saved.draft?.type_code) return;
      setDraft({ ...emptyDraft(prefill), ...saved.draft });
      setStep(saved.step ?? "type");
      setRestored(true);
    } catch { /* brouillon illisible : ignoré */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draft.type_code) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ owner: currentUserId, draft, step }));
    } catch { /* stockage indisponible */ }
  }, [draft, step, currentUserId]);

  // Focus sur le titre de chaque écran (lecteurs d'écran, clavier).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((e) => { const { [k as string]: _, ...rest } = e; return rest; });
  };
  const toggleIn = (k: "contributeurs" | "commissions_associees" | "partenaires", id: string) =>
    set(k, draft[k].includes(id) ? draft[k].filter((x) => x !== id) : [...draft[k], id]);

  const typeRow = types.find((t) => t.code === draft.type_code) ?? null;
  const steps = draft.type_code ? STEPS[draft.type_code] : ["type" as Step];
  const index = steps.indexOf(step);

  const elus = people.filter((p) => ELU_TITLES.includes(p.job_title ?? ""));
  const agents = people.filter((p) => AGENT_TITLES.includes(p.job_title ?? ""));
  const autres = people.filter((p) => !ELU_TITLES.includes(p.job_title ?? "") && !AGENT_TITLES.includes(p.job_title ?? ""));

  // ─── Jalons proposés (récapitulatif) ───
  const jalons: JalonPropose[] = useMemo(() => {
    if (!typeRow) return [];
    const base = proposerJalons(typeRow.jalons_modele, draft.type_code === "evenementiel" ? draft.evenement_date : null);
    return base.map((j) => ({
      ...j,
      coche: j.conditionnel ? draft.jalons_ajoutes.includes(j.libelle) : !draft.jalons_retires.includes(j.libelle),
    }));
  }, [typeRow, draft.type_code, draft.evenement_date, draft.jalons_ajoutes, draft.jalons_retires]);

  function toggleJalon(j: JalonPropose) {
    if (j.conditionnel) {
      set("jalons_ajoutes", j.coche ? draft.jalons_ajoutes.filter((x) => x !== j.libelle) : [...draft.jalons_ajoutes, j.libelle]);
    } else {
      set("jalons_retires", j.coche ? [...draft.jalons_retires, j.libelle] : draft.jalons_retires.filter((x) => x !== j.libelle));
    }
  }

  // ─── Validation par écran ───
  function stepErrors(s: Step): Record<string, string> {
    const e: Record<string, string> = {};
    if ((s === "suivi" || s === "quoi") && !draft.titre.trim()) e.titre = "Donnez un titre au projet.";
    if ((s === "suivi" || s === "qui") && !draft.elu_referent_id) {
      e.elu_referent_id = "Choisissez l'élu référent : une seule personne responsable du suivi.";
    }
    if (s === "quand_ou") {
      if (!draft.evenement_date) e.evenement_date = "Indiquez la date de l'événement.";
      if (draft.evenement_heure_debut && draft.evenement_heure_fin && draft.evenement_heure_fin < draft.evenement_heure_debut) {
        e.evenement_heure_fin = "L'heure de fin doit suivre l'heure de début.";
      }
    }
    return e;
  }

  function next() {
    const e = stepErrors(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    if (index < steps.length - 1) setStep(steps[index + 1]);
  }
  function back() {
    if (index > 0) setStep(steps[index - 1]);
  }
  function chooseType(code: TypeProjetCode) {
    setDraft((d) => ({ ...d, type_code: code }));
    setStep(STEPS[code][1]);
  }
  function restart() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setDraft(emptyDraft(prefill));
    setStep("type");
    setRestored(false);
    setErrors({});
  }

  async function addPartner() {
    const nom = newPartner.trim();
    if (!nom) return;
    const res = await fetch("/api/stakeholders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, type: "citoyenne", nature: "association" }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.stakeholder) {
      setPartners((p) => [...p, json.stakeholder as Stakeholder]);
      set("partenaires", [...draft.partenaires, (json.stakeholder as Stakeholder).id]);
      setNewPartner("");
    }
  }

  async function submit() {
    if (!draft.type_code) return;
    const input = {
      ...draft,
      type_code: draft.type_code,
      jauge: draft.jauge,
      jalons: jalons.filter((j) => j.coche).map((j) => ({ libelle: j.libelle, date_previsionnelle: j.date_previsionnelle, verrou: j.verrou })),
    };
    const v = validateWizard(input);
    if (!v.ok) {
      setErrors(v.errors);
      const firstStep = steps.find((s) => Object.keys(stepErrors(s)).length > 0);
      if (firstStep) setStep(firstStep);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) {
        if (json.fields) setErrors(json.fields);
        setSubmitError(json.error ?? "La création a échoué. Vos saisies sont conservées : réessayez.");
        setSubmitting(false);
        return;
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      router.push(`/admin/projects/${json.id}`);
    } catch {
      setSubmitError("Connexion impossible. Vos saisies sont conservées : réessayez.");
      setSubmitting(false);
    }
  }

  // ─── Rendu d'un champ ───
  const err = (k: string) => errors[k] ? <p id={`${k}-err`} className="civiq-field-error-msg" role="alert">{errors[k]}</p> : null;
  const aria = (k: string, hint?: string) => ({
    "aria-invalid": !!errors[k] || undefined,
    "aria-describedby": [hint, errors[k] ? `${k}-err` : null].filter(Boolean).join(" ") || undefined,
  });

  const personSelect = (id: string, key: "elu_referent_id" | "agent_pilote_id", label: string, required: boolean) => (
    <div className="civiq-field">
      <label htmlFor={id} className="civiq-field-label">
        {label}{required ? <span className="civiq-required" aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={id}
        className="civiq-select"
        value={draft[key]}
        onChange={(e) => set(key, e.target.value)}
        required={required}
        {...aria(key, key === "elu_referent_id" ? "elu-help" : undefined)}
      >
        <option value="">{required ? "Choisir…" : "Aucun pour l'instant"}</option>
        {(key === "elu_referent_id" ? [["Élus", elus], ["Agents", agents], ["Autres membres", autres]] : [["Agents", agents], ["Élus", elus], ["Autres membres", autres]])
          .filter(([, list]) => (list as WizardPerson[]).length)
          .map(([g, list]) => (
            <optgroup key={g as string} label={g as string}>
              {(list as WizardPerson[]).map((p) => <option key={p.id} value={p.id}>{personLabel(p)}</option>)}
            </optgroup>
          ))}
      </select>
      {err(key)}
    </div>
  );

  const commissionSelect = (
    <div className="civiq-field">
      <label htmlFor="w-commission" className="civiq-field-label">Commission qui pilote le projet</label>
      <select id="w-commission" className="civiq-select" value={draft.commission_pilote_id} onChange={(e) => set("commission_pilote_id", e.target.value)}>
        <option value="">Aucune commission</option>
        {commissions.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select>
    </div>
  );

  const titreField = (
    <div className="civiq-field">
      <label htmlFor="w-titre" className="civiq-field-label">Titre du projet<span className="civiq-required" aria-hidden="true"> *</span></label>
      <input id="w-titre" className="civiq-input" value={draft.titre} maxLength={200} onChange={(e) => set("titre", e.target.value)} required autoFocus {...aria("titre")} />
      {err("titre")}
    </div>
  );

  const eluHelp = (
    <FieldHelp id="elu-referent">
      <p id="elu-help">Une seule personne responsable du suivi. Vous pourrez ajouter d&apos;autres participants juste en dessous.</p>
    </FieldHelp>
  );

  // ─── Écrans ───
  let body: React.ReactNode = null;
  let title = "";

  switch (step) {
    case "type":
      title = "Quel type de projet voulez-vous créer ?";
      body = (
        <>
          <div className="pj-wiz-types">
            {types.map((t) => {
              const meta = TYPE_META[t.code];
              return (
                <button key={t.code} type="button" className={`pj-wiz-type pj-wiz-type-${meta.cssVar}`} onClick={() => chooseType(t.code)}>
                  <span className="pj-wiz-type-icon"><meta.Icon size={22} aria-hidden="true" /></span>
                  <span className="pj-wiz-type-label">{t.libelle}</span>
                  <span className="pj-wiz-type-examples">{t.exemples.join(" · ")}</span>
                </button>
              );
            })}
          </div>
          <p className="pj-wiz-note">Vous pourrez changer de type plus tard sans rien perdre.</p>
        </>
      );
      break;

    case "suivi":
      title = "Un suivi simple : trois informations suffisent";
      body = (
        <>
          {titreField}
          {commissionSelect}
          {personSelect("w-elu", "elu_referent_id", "Élu référent", true)}
          {eluHelp}
          <p className="pj-wiz-note">Photo, description, étapes : vous les ajouterez ensuite, quand vous voudrez.</p>
        </>
      );
      break;

    case "quoi":
      title = draft.type_code === "evenementiel" ? "Quel événement ?" : "Quoi ?";
      body = (
        <>
          {titreField}
          <div className="civiq-field">
            <label htmlFor="w-desc" className="civiq-field-label">{draft.type_code === "evenementiel" ? "Description" : "Description et objectif"}</label>
            <textarea id="w-desc" className="civiq-textarea" rows={4} value={draft.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <p className="pj-wiz-note">La photo de couverture s&apos;ajoute ensuite, depuis la page du projet.</p>
        </>
      );
      break;

    case "qui":
      title = draft.type_code === "evenementiel" ? "Qui organise ?" : "Qui ?";
      body = (
        <>
          {commissionSelect}
          {personSelect("w-elu", "elu_referent_id", "Élu référent", true)}
          {eluHelp}
          {draft.type_code === "investissement" && personSelect("w-agent", "agent_pilote_id", "Agent pilote (facultatif)", false)}
          {people.length > 1 && (
            <fieldset className="pj-wiz-fieldset">
              <legend className="civiq-field-label">Autres participants (facultatif)</legend>
              <div className="pj-wiz-checks">
                {people.filter((p) => p.id !== draft.elu_referent_id).map((p) => (
                  <label key={p.id} className="pj-wiz-check">
                    <input type="checkbox" checked={draft.contributeurs.includes(p.id)} onChange={() => toggleIn("contributeurs", p.id)} />
                    {personLabel(p)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {commissions.length > 1 && (
            <fieldset className="pj-wiz-fieldset">
              <legend className="civiq-field-label">Autres commissions concernées (facultatif)</legend>
              <div className="pj-wiz-checks">
                {commissions.filter((c) => c.id !== draft.commission_pilote_id).map((c) => (
                  <label key={c.id} className="pj-wiz-check">
                    <input type="checkbox" checked={draft.commissions_associees.includes(c.id)} onChange={() => toggleIn("commissions_associees", c.id)} />
                    <span className="pj-wiz-dot" style={{ background: c.color }} aria-hidden="true" /> {c.nom}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {draft.type_code === "evenementiel" && (
            <fieldset className="pj-wiz-fieldset">
              <legend className="civiq-field-label">Associations partenaires (facultatif)</legend>
              <div className="pj-wiz-checks">
                {partners.map((a) => (
                  <label key={a.id} className="pj-wiz-check">
                    <input type="checkbox" checked={draft.partenaires.includes(a.id)} onChange={() => toggleIn("partenaires", a.id)} />
                    {a.nom}{a.organisation ? ` (${a.organisation})` : ""}
                  </label>
                ))}
              </div>
              <div className="pj-wiz-inline">
                <label htmlFor="w-new-partner" className="pj-sr-only">Nom de l&apos;association à ajouter</label>
                <input id="w-new-partner" className="civiq-input" placeholder="Ajouter une association…" value={newPartner} onChange={(e) => setNewPartner(e.target.value)} />
                <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={addPartner} disabled={!newPartner.trim()}>Ajouter</button>
              </div>
            </fieldset>
          )}
        </>
      );
      break;

    case "combien":
      title = "Combien, à peu près ?";
      body = (
        <>
          <p className="pj-wiz-lead">
            Une estimation grossière suffit. Elle sert juste à vous prévenir des règles de marchés publics qui
            s&apos;appliqueront. Vous saisirez le budget détaillé plus tard.
          </p>
          <div className="pj-wiz-choices" role="radiogroup" aria-label="Estimation du coût">
            {FOURCHETTES.map((f) => (
              <button
                key={f.code}
                type="button"
                role="radio"
                aria-checked={draft.fourchette_estimation === f.code}
                className={`pj-wiz-choice${draft.fourchette_estimation === f.code ? " is-selected" : ""}`}
                onClick={() => set("fourchette_estimation", f.code)}
              >
                {draft.fourchette_estimation === f.code ? <Check size={14} aria-hidden="true" /> : null}
                {f.label}
              </button>
            ))}
          </div>
        </>
      );
      break;

    case "quand":
      title = "Pour quand ?";
      body = (
        <>
          <div className="civiq-field">
            <label htmlFor="w-echeance" className="civiq-field-label">Échéance souhaitée</label>
            <p id="echeance-hint" className="civiq-field-hint">Approximative, modifiable à tout moment.</p>
            <input id="w-echeance" type="date" className="civiq-input" value={draft.echeance_souhaitee}
              disabled={draft.sans_echeance} onChange={(e) => set("echeance_souhaitee", e.target.value)} aria-describedby="echeance-hint" />
          </div>
          <label className="pj-wiz-check">
            <input type="checkbox" checked={draft.sans_echeance} onChange={(e) => set("sans_echeance", e.target.checked)} />
            Pas d&apos;échéance définie
          </label>
        </>
      );
      break;

    case "quand_ou":
      title = "Quand et où ?";
      body = (
        <>
          <div className="civiq-field">
            <label htmlFor="w-date" className="civiq-field-label">Date de l&apos;événement<span className="civiq-required" aria-hidden="true"> *</span></label>
            <input id="w-date" type="date" className="civiq-input" value={draft.evenement_date} onChange={(e) => set("evenement_date", e.target.value)} required {...aria("evenement_date")} />
            {err("evenement_date")}
          </div>
          <div className="pj-wiz-row">
            <div className="civiq-field">
              <label htmlFor="w-debut" className="civiq-field-label">Heure de début</label>
              <input id="w-debut" type="time" className="civiq-input" value={draft.evenement_heure_debut} onChange={(e) => set("evenement_heure_debut", e.target.value)} />
            </div>
            <div className="civiq-field">
              <label htmlFor="w-fin" className="civiq-field-label">Heure de fin</label>
              <input id="w-fin" type="time" className="civiq-input" value={draft.evenement_heure_fin} onChange={(e) => set("evenement_heure_fin", e.target.value)} {...aria("evenement_heure_fin")} />
              {err("evenement_heure_fin")}
            </div>
          </div>
          <div className="civiq-field">
            <label htmlFor="w-lieu" className="civiq-field-label">Lieu</label>
            <input id="w-lieu" className="civiq-input" value={draft.lieu} onChange={(e) => set("lieu", e.target.value)} placeholder="Ex. salle des fêtes" />
          </div>
          <div className="civiq-field">
            <label htmlFor="w-jauge" className="civiq-field-label">Nombre de personnes attendues (environ)</label>
            <input id="w-jauge" className="civiq-input" inputMode="numeric" value={draft.jauge} onChange={(e) => set("jauge", e.target.value.replace(/\D/g, ""))} {...aria("jauge")} />
            {err("jauge")}
          </div>
        </>
      );
      break;

    case "recap": {
      title = "Récapitulatif";
      const encart = draft.type_code === "investissement" ? encartMarchesPublics(draft.fourchette_estimation) : null;
      const commission = commissions.find((c) => c.id === draft.commission_pilote_id);
      const elu = people.find((p) => p.id === draft.elu_referent_id);
      body = (
        <>
          <dl className="pj-wiz-summary">
            <div><dt>Projet</dt><dd>{draft.titre || "—"}</dd></div>
            <div><dt>Type</dt><dd>{typeRow?.libelle}</dd></div>
            <div><dt>Commission</dt><dd>{commission?.nom ?? "Aucune"}</dd></div>
            <div><dt>Élu référent</dt><dd>{elu ? personLabel(elu) : "—"}</dd></div>
            {draft.type_code === "investissement" && (
              <>
                <div><dt>Estimation</dt><dd>{FOURCHETTES.find((f) => f.code === draft.fourchette_estimation)?.label ?? "Non renseignée"}</dd></div>
                <div><dt>Échéance</dt><dd>{draft.sans_echeance || !draft.echeance_souhaitee ? "Pas d'échéance définie" : formatEtapeDate(`${draft.echeance_souhaitee}T00:00:00.000Z`)}</dd></div>
              </>
            )}
            {draft.type_code === "evenementiel" && (
              <div><dt>Date</dt><dd>{formatEtapeDate(`${draft.evenement_date}T${draft.evenement_heure_debut || "00:00"}:00.000Z`)}{draft.lieu ? ` — ${draft.lieu}` : ""}</dd></div>
            )}
          </dl>

          {jalons.length > 0 && (
            <fieldset className="pj-wiz-fieldset">
              <legend className="pj-wiz-legend">
                {draft.type_code === "evenementiel" ? "Le rétroplanning que nous vous préparons" : "Voici les étapes que nous vous préparons"}
              </legend>
              <p className="pj-wiz-note">Décochez celles qui ne concernent pas votre projet. Vous pourrez en ajouter d&apos;autres.</p>
              <ul className="pj-wiz-jalons">
                {jalons.map((j) => (
                  <li key={j.libelle}>
                    <label className="pj-wiz-check">
                      <input type="checkbox" checked={j.coche} onChange={() => toggleJalon(j)} />
                      <span>
                        {j.offset_jours !== null && <strong className="pj-wiz-offset">{formatOffset(j.offset_jours)}</strong>}{" "}
                        {j.libelle}
                        {j.date_previsionnelle && <span className="pj-wiz-date"> — {formatEtapeDate(j.date_previsionnelle)}</span>}
                        {j.aide && <span className="pj-wiz-aide">{j.aide}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {encart && (
            <section className={`pj-alerte pj-alerte-${encart.registre === "obligatoire" ? "obligatoire" : encart.registre === "recommande" ? "recommande" : "information"}`} aria-labelledby="encart-titre">
              <h3 id="encart-titre" className="pj-alerte-titre">{encart.titre}</h3>
              {encart.paragraphes.map((p) => <p key={p}>{p}</p>)}
              {encart.enSavoirPlus.length > 0 && (
                <LearnMore>{encart.enSavoirPlus.map((p) => <p key={p}>{p}</p>)}</LearnMore>
              )}
            </section>
          )}
          {submitError && <p className="pj-modal-error" role="alert">{submitError}</p>}
        </>
      );
      break;
    }
  }

  const isLast = step === "recap" || step === "suivi";

  return (
    <div className="pj-wiz">
      {draft.type_code && (
        <div className="pj-wiz-progress" aria-hidden="true">
          <div className="pj-wiz-progress-fill" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
      )}
      {restored && (
        <p className="pj-wiz-restored" role="status">
          Nous avons retrouvé votre brouillon.{" "}
          <button type="button" className="pj-link-btn" onClick={restart}><RotateCcw size={12} aria-hidden="true" /> Recommencer</button>
        </p>
      )}
      <form
        className="civiq-card pj-wiz-card"
        onSubmit={(e) => { e.preventDefault(); if (isLast) void submit(); else next(); }}
        noValidate
      >
        {draft.type_code && step !== "type" && (
          <p className="pj-wiz-step">Étape {index} sur {steps.length - 1}</p>
        )}
        <h2 ref={headingRef} tabIndex={-1} className="pj-wiz-title">{title}</h2>
        <div className="pj-wiz-body">{body}</div>
        {step !== "type" && (
          <div className="pj-wiz-actions">
            <button type="button" className="civiq-btn civiq-btn-ghost" onClick={back} disabled={submitting}>
              <ArrowLeft size={16} aria-hidden="true" /> Retour
            </button>
            {isLast ? (
              <button type="submit" className="civiq-btn civiq-btn-default" disabled={submitting}>
                {submitting ? <Loader2 size={16} className="civiq-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                Créer le projet
              </button>
            ) : (
              <button type="submit" className="civiq-btn civiq-btn-default">
                Continuer <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
