"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { SurveySchema, SurveyField } from "@/types/survey";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Lock,
  CornerDownLeft,
} from "lucide-react";

// ═══════════════════════════════════════════════════
// SURVEY RENDERER — Flow UX (une question / un écran)
// Inspiration Typeform : enchaînement fluide, animations
// directionnelles, auto-advance sur choix unique, full
// hauteur mobile avec footer sticky.
// ═══════════════════════════════════════════════════

interface SurveyRendererProps {
  schema: SurveySchema;
  surveyId: string;
  communeSlug: string;
  primaryColor?: string;
  accentColor?: string;
  headerText?: string;
  thankYouText?: string;
  requireConsent?: boolean;
  consentText?: string;
  rgpdFinalite?: string;
  rgpdDureeJours?: number;
  rgpdContactEmail?: string;
  onSubmit?: (data: Record<string, unknown>) => Promise<void>;
}

// ─── Flat question model ───
// On aplatit toutes les étapes en une liste de questions
// pour pouvoir naviguer écran-par-écran. Le titre de l'étape
// est exposé comme libellé de section au-dessus de chaque question.

interface FlatQuestion {
  field: SurveyField;
  stepIndex: number;
  stepTitle: string;
}

function buildQuestions(schema: SurveySchema): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  schema.steps.forEach((step, sIdx) => {
    step.fields.forEach((field) => {
      out.push({ field, stepIndex: sIdx, stepTitle: step.title });
    });
  });
  return out;
}

function fieldVisible(
  field: SurveyField,
  data: Record<string, unknown>
): boolean {
  if (!field.conditional) return true;
  const depVal = data[field.conditional.field];
  return Array.isArray(field.conditional.value)
    ? field.conditional.value.includes(depVal as string)
    : depVal === field.conditional.value;
}

function hasValue(val: unknown): boolean {
  if (val === undefined || val === null || val === "") return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}

// Types qui s'auto-avancent après sélection
const AUTO_ADVANCE_TYPES = new Set(["radio", "select", "scale"]);

export default function SurveyRenderer({
  schema,
  surveyId,
  communeSlug: _communeSlug,
  primaryColor = "#1a2744",
  accentColor = "#c9a84c",
  thankYouText,
  requireConsent = true,
  consentText = "Je consens à ce que mes réponses soient collectées et analysées dans le cadre de cette consultation. Je peux exercer mes droits (accès, rectification, suppression) en contactant la commune.",
  rgpdFinalite,
  rgpdDureeJours,
  rgpdContactEmail,
  onSubmit,
}: SurveyRendererProps) {
  void _communeSlug;
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [cursor, setCursor] = useState(0); // index dans allQuestions
  const [direction, setDirection] = useState<1 | -1>(1);
  const [atConsent, setAtConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [consentGiven, setConsentGiven] = useState(false);
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allQuestions = useMemo(() => buildQuestions(schema), [schema]);

  // Indices des questions effectivement visibles (les conditionnels masqués sont retirés)
  const visibleIndices = useMemo(
    () =>
      allQuestions
        .map((q, i) => ({ q, i }))
        .filter(({ q }) => fieldVisible(q.field, formData))
        .map(({ i }) => i),
    [allQuestions, formData]
  );

  const currentQuestion = atConsent ? null : allQuestions[cursor];
  const currentVisiblePos = visibleIndices.indexOf(cursor);
  const totalVisible = visibleIndices.length + (requireConsent ? 1 : 0);
  const stepPos = atConsent ? totalVisible : currentVisiblePos + 1;
  const progress = submitted
    ? 100
    : Math.min(100, Math.round((stepPos / Math.max(totalVisible, 1)) * 100));

  // ID du dernier champ pour lequel l'utilisateur vient de saisir une valeur.
  // Sert à éviter de re-déclencher l'auto-advance quand on revient en arrière
  // sur une question déjà répondue.
  const justAnsweredRef = useRef<string | null>(null);

  // ─── Setters ───
  const setValue = useCallback((fieldId: string, value: unknown) => {
    justAnsweredRef.current = fieldId;
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    setErrorMsg(null);
  }, []);

  const toggleArrayValue = useCallback((fieldId: string, value: string) => {
    justAnsweredRef.current = fieldId;
    setFormData((prev) => {
      const arr = (prev[fieldId] as string[]) || [];
      return {
        ...prev,
        [fieldId]: arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value],
      };
    });
    setErrorMsg(null);
  }, []);

  // ─── Validation question courante ───
  const validateCurrent = useCallback((): string | null => {
    if (atConsent || !currentQuestion) return null;
    const f = currentQuestion.field;
    if (!f.required) return null;
    const val = formData[f.id];
    if (!hasValue(val)) return "Cette réponse est obligatoire";
    if (f.type === "email" && typeof val === "string") {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      if (!ok) return "Adresse email invalide";
    }
    if (f.type === "number" && typeof val === "number") {
      if (f.min !== undefined && val < f.min) return `Valeur minimale : ${f.min}`;
      if (f.max !== undefined && val > f.max) return `Valeur maximale : ${f.max}`;
    }
    return null;
  }, [atConsent, currentQuestion, formData]);

  // ─── Navigation ───
  const goNext = useCallback(() => {
    if (submitted || submitting) return;
    if (atConsent) return;

    const err = validateCurrent();
    if (err) {
      setErrorMsg(err);
      setShake(true);
      setTimeout(() => setShake(false), 380);
      return;
    }
    setErrorMsg(null);

    // chercher la prochaine question visible
    const next = visibleIndices.find((i) => i > cursor);
    setDirection(1);
    if (next === undefined) {
      if (requireConsent) {
        setAtConsent(true);
      } else {
        // Pas de consent → submit direct
        void handleSubmit();
      }
    } else {
      setCursor(next);
    }
  }, [
    atConsent,
    cursor,
    visibleIndices,
    validateCurrent,
    requireConsent,
    submitted,
    submitting,
  ]); // handleSubmit défini plus bas mais référence stable

  const goPrev = useCallback(() => {
    if (submitted || submitting) return;
    setErrorMsg(null);
    justAnsweredRef.current = null;
    setDirection(-1);
    if (atConsent) {
      setAtConsent(false);
      return;
    }
    const prevs = visibleIndices.filter((i) => i < cursor);
    if (prevs.length === 0) return;
    setCursor(prevs[prevs.length - 1]);
  }, [atConsent, cursor, visibleIndices, submitted, submitting]);

  const handleSubmit = useCallback(async () => {
    if (requireConsent && !consentGiven) {
      setErrorMsg("Vous devez accepter le consentement pour envoyer vos réponses.");
      setShake(true);
      setTimeout(() => setShake(false), 380);
      return;
    }
    setSubmitting(true);
    try {
      const duration = Math.round((Date.now() - startTime) / 1000);
      const payload = { ...formData, _duration_seconds: duration };

      if (onSubmit) {
        await onSubmit(payload);
      } else {
        await fetch(`/api/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            survey_id: surveyId,
            data: payload,
            respondent_name: formData.nom as string,
            respondent_email: formData.email as string,
            respondent_phone: formData.telephone as string,
            duration_seconds: duration,
            consent_given: requireConsent ? consentGiven : true,
            consent_text: requireConsent ? consentText : null,
          }),
        });
      }
      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
      setErrorMsg("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }, [
    formData,
    onSubmit,
    surveyId,
    startTime,
    consentGiven,
    consentText,
    requireConsent,
  ]);

  // ─── Auto-advance sur choix unique ───
  // Une fois la valeur posée sur un champ radio/select/scale,
  // on enchaîne automatiquement après 380ms pour laisser le
  // micro-feedback de sélection s'afficher.
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFieldId = currentQuestion?.field.id;
  const currentFieldType = currentQuestion?.field.type;
  const currentValue = currentFieldId ? formData[currentFieldId] : undefined;
  useEffect(() => {
    if (atConsent || submitted) return;
    if (!currentFieldType || !AUTO_ADVANCE_TYPES.has(currentFieldType)) return;
    if (!hasValue(currentValue)) return;
    // Auto-advance uniquement si la valeur vient d'être saisie pour CE champ
    // pendant la visite courante (pas si on revient sur une question déjà répondue).
    if (justAnsweredRef.current !== currentFieldId) return;
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    autoAdvanceRef.current = setTimeout(() => {
      justAnsweredRef.current = null;
      goNext();
    }, 380);
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [currentFieldId, currentFieldType, currentValue, atConsent, submitted, goNext]);

  // ─── Raccourcis clavier ───
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Entrée → continuer (sauf dans textarea, ou Shift+Entrée)
      if (e.key === "Enter" && !e.shiftKey) {
        const t = e.target as HTMLElement | null;
        if (t && t.tagName === "TEXTAREA") return;
        // Sur un input texte, Enter est un raccourci valide
        e.preventDefault();
        if (atConsent) {
          void handleSubmit();
        } else {
          goNext();
        }
      }
      // Esc → retour
      if (e.key === "Escape") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, atConsent, handleSubmit]);

  // ─── Autofocus de l'input à chaque transition ───
  const screenRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (submitted) return;
    // petit délai pour laisser l'animation se poser
    const t = setTimeout(() => {
      const root = screenRef.current;
      if (!root) return;
      const focusable = root.querySelector<HTMLElement>(
        "input:not([type=checkbox]):not([type=radio]), textarea, select"
      );
      focusable?.focus({ preventScroll: true });
    }, 80);
    return () => clearTimeout(t);
  }, [cursor, atConsent, submitted]);

  // ─── Render des champs ───
  const renderField = useCallback(
    (field: SurveyField) => {
      const value = formData[field.id];

      switch (field.type) {
        case "text":
        case "email":
        case "tel":
          return (
            <input
              type={field.type}
              value={(value as string) || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="civiq-flow-input"
              autoComplete={
                field.type === "email"
                  ? "email"
                  : field.type === "tel"
                  ? "tel"
                  : "off"
              }
            />
          );

        case "textarea":
          return (
            <textarea
              value={(value as string) || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="civiq-flow-input civiq-flow-textarea"
              rows={4}
            />
          );

        case "number":
          return (
            <input
              type="number"
              inputMode="numeric"
              value={(value as number) ?? ""}
              onChange={(e) =>
                setValue(
                  field.id,
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              className="civiq-flow-input"
            />
          );

        case "date":
          return (
            <input
              type="date"
              value={(value as string) || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              min={field.min !== undefined ? String(field.min) : undefined}
              max={field.max !== undefined ? String(field.max) : undefined}
              className="civiq-flow-input"
            />
          );

        case "select":
          return (
            <div className="civiq-flow-options">
              {field.options?.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`civiq-flow-option${
                    value === opt.value ? " selected" : ""
                  }`}
                  onClick={() => setValue(field.id, opt.value)}
                  style={
                    value === opt.value
                      ? {
                          borderColor: primaryColor,
                          background: `${primaryColor}10`,
                        }
                      : undefined
                  }
                >
                  <span className="civiq-flow-option-key">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="civiq-flow-option-text">
                    <strong>{opt.label}</strong>
                    {opt.sublabel && <span>{opt.sublabel}</span>}
                  </span>
                  {value === opt.value && (
                    <Check size={16} className="civiq-flow-option-tick" />
                  )}
                </button>
              ))}
            </div>
          );

        case "radio":
          return (
            <div className="civiq-flow-options">
              {field.options?.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`civiq-flow-option${
                    value === opt.value ? " selected" : ""
                  }`}
                  onClick={() => setValue(field.id, opt.value)}
                  style={
                    value === opt.value
                      ? {
                          borderColor: primaryColor,
                          background: `${primaryColor}10`,
                        }
                      : undefined
                  }
                >
                  <span className="civiq-flow-option-key">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="civiq-flow-option-text">
                    <strong>{opt.label}</strong>
                    {opt.sublabel && <span>{opt.sublabel}</span>}
                  </span>
                  {value === opt.value && (
                    <Check size={16} className="civiq-flow-option-tick" />
                  )}
                </button>
              ))}
            </div>
          );

        case "checkbox":
        case "checkbox_grid": {
          const arrVal = (value as string[]) || [];
          return (
            <div
              className={`civiq-flow-options${
                field.columns === 2 ? " civiq-flow-options-grid" : ""
              }`}
            >
              {field.options?.map((opt, idx) => {
                const checked = arrVal.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`civiq-flow-option${checked ? " selected" : ""}`}
                    onClick={() => toggleArrayValue(field.id, opt.value)}
                    style={
                      checked
                        ? {
                            borderColor: primaryColor,
                            background: `${primaryColor}10`,
                          }
                        : undefined
                    }
                  >
                    <span className="civiq-flow-option-key">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="civiq-flow-option-text">
                      <strong>{opt.label}</strong>
                      {opt.sublabel && <span>{opt.sublabel}</span>}
                    </span>
                    {checked && (
                      <Check size={16} className="civiq-flow-option-tick" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        }

        case "scale": {
          const min = field.min ?? 1;
          const max = field.max ?? 5;
          const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
          return (
            <div className="civiq-flow-scale-wrap">
              <div className="civiq-flow-scale">
                {nums.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`civiq-flow-scale-btn${
                      value === n ? " selected" : ""
                    }`}
                    onClick={() => setValue(field.id, n)}
                    style={
                      value === n
                        ? { background: primaryColor, borderColor: primaryColor, color: "#fff" }
                        : undefined
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
              {(field.min_label || field.max_label) && (
                <div className="civiq-flow-scale-labels">
                  <span>{field.min_label}</span>
                  <span>{field.max_label}</span>
                </div>
              )}
            </div>
          );
        }

        default:
          return null;
      }
    },
    [formData, setValue, toggleArrayValue, primaryColor]
  );

  // ─── Écran de remerciement ───
  if (submitted) {
    return (
      <div className="civiq-flow-wrap">
        <div className="civiq-flow-thankyou">
          <div
            className="civiq-flow-check"
            style={{ background: primaryColor }}
          >
            <Check size={36} />
          </div>
          <h2>Merci pour votre participation !</h2>
          <p>
            {thankYouText ||
              "Vos réponses ont bien été enregistrées. Elles seront analysées pour construire une offre adaptée à vos besoins."}
          </p>
        </div>
      </div>
    );
  }

  // ─── Wrapper principal ───
  return (
    <div className="civiq-flow-wrap">
      {/* Barre de progression sticky en haut */}
      <div className="civiq-flow-progress-bar">
        <div
          className="civiq-flow-progress-fill"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})`,
          }}
        />
      </div>

      <div className="civiq-flow-screen-host">
        <div
          key={atConsent ? "__consent" : `q-${cursor}`}
          ref={screenRef}
          className={`civiq-flow-screen civiq-flow-enter-${
            direction > 0 ? "right" : "left"
          }${shake ? " civiq-flow-shake" : ""}`}
        >
            {atConsent ? (
              // ── Écran consentement / récap ──
              <div className="civiq-flow-question">
                <div className="civiq-flow-section">
                  <span className="civiq-flow-section-dot" style={{ background: accentColor }} />
                  Dernière étape
                </div>
                <h2 className="civiq-flow-label">
                  Confirmation et envoi
                </h2>
                <p className="civiq-flow-hint">
                  Vérifiez les conditions de traitement de vos données avant
                  d'envoyer vos réponses.
                </p>

                <div className="civiq-flow-consent">
                  <div className="civiq-flow-consent-header">
                    <Lock size={14} /> Protection de vos données
                  </div>
                  {(rgpdFinalite || rgpdDureeJours) && (
                    <ul className="civiq-flow-consent-meta">
                      {rgpdFinalite && (
                        <li>
                          <strong>Finalité :</strong> {rgpdFinalite}
                        </li>
                      )}
                      {rgpdDureeJours ? (
                        <li>
                          <strong>Conservation :</strong> {rgpdDureeJours} jours
                        </li>
                      ) : null}
                      {rgpdContactEmail && (
                        <li>
                          <strong>Vos droits :</strong>{" "}
                          <a href={`mailto:${rgpdContactEmail}`}>
                            {rgpdContactEmail}
                          </a>
                        </li>
                      )}
                    </ul>
                  )}
                  <label className="civiq-flow-consent-check">
                    <input
                      type="checkbox"
                      checked={consentGiven}
                      onChange={(e) => setConsentGiven(e.target.checked)}
                    />
                    <span>{consentText}</span>
                  </label>
                </div>

                {errorMsg && (
                  <p className="civiq-flow-error">⚠ {errorMsg}</p>
                )}
              </div>
            ) : currentQuestion ? (
              // ── Écran question ──
              <div className="civiq-flow-question">
                <div className="civiq-flow-section">
                  <span className="civiq-flow-section-dot" style={{ background: accentColor }} />
                  {currentQuestion.stepTitle}
                </div>
                <h2 className="civiq-flow-label">
                  {currentQuestion.field.label}
                  {currentQuestion.field.required && (
                    <span className="civiq-flow-required" aria-label="obligatoire">
                      *
                    </span>
                  )}
                </h2>
                {currentQuestion.field.hint && (
                  <p className="civiq-flow-hint">{currentQuestion.field.hint}</p>
                )}

                <div className="civiq-flow-input-wrap">
                  {renderField(currentQuestion.field)}
                </div>

                {errorMsg && (
                  <p className="civiq-flow-error">⚠ {errorMsg}</p>
                )}
              </div>
            ) : null}
        </div>
      </div>

      {/* Footer sticky : compteur + boutons */}
      <div className="civiq-flow-footer">
        <div className="civiq-flow-footer-inner">
          <div className="civiq-flow-counter" aria-live="polite">
            <span className="civiq-flow-counter-num">{stepPos}</span>
            <span className="civiq-flow-counter-sep">/</span>
            <span className="civiq-flow-counter-total">{totalVisible}</span>
          </div>

          <div className="civiq-flow-actions">
            <button
              type="button"
              className="civiq-flow-back"
              onClick={goPrev}
              disabled={!atConsent && currentVisiblePos <= 0}
              aria-label="Question précédente"
              title="Précédent (Échap)"
            >
              <ChevronLeft size={20} />
            </button>

            {atConsent ? (
              <button
                type="button"
                className="civiq-flow-next civiq-flow-submit"
                onClick={handleSubmit}
                disabled={submitting || (requireConsent && !consentGiven)}
                style={{ background: accentColor, color: primaryColor }}
              >
                {submitting ? "Envoi…" : "Envoyer mes réponses"}
                <Check size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="civiq-flow-next"
                onClick={goNext}
                style={{ background: primaryColor }}
              >
                <span>OK</span>
                <CornerDownLeft
                  size={14}
                  className="civiq-flow-kbd"
                  aria-hidden
                />
                <ChevronRight size={18} className="civiq-flow-arrow" />
              </button>
            )}
          </div>
        </div>
        <div className="civiq-flow-hint-kbd" aria-hidden>
          Appuyez sur <kbd>Entrée</kbd> pour continuer
        </div>
      </div>
    </div>
  );
}
