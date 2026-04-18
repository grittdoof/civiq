"use client";

import { useState, useCallback, useMemo } from "react";
import type { SurveySchema, SurveyField, SurveyStep } from "@/types/survey";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Clock,
  Lock,
} from "lucide-react";

// ═══════════════════════════════════════════════════
// SURVEY RENDERER — Moteur de rendu dynamique
// Génère un formulaire multi-étapes à partir du JSON schema
// ═══════════════════════════════════════════════════

interface SurveyRendererProps {
  schema: SurveySchema;
  surveyId: string;
  communeSlug: string;
  primaryColor?: string;
  accentColor?: string;
  headerText?: string;
  thankYouText?: string;
  onSubmit?: (data: Record<string, unknown>) => Promise<void>;
}

export default function SurveyRenderer({
  schema,
  surveyId,
  communeSlug,
  primaryColor = "#1a2744",
  accentColor = "#c9a84c",
  headerText,
  thankYouText,
  onSubmit,
}: SurveyRendererProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  const steps = schema.steps;
  const totalSteps = steps.length;
  const progress = submitted
    ? 100
    : Math.round((currentStep / totalSteps) * 100);

  // ─── Field value handlers ───

  const setValue = useCallback((fieldId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const toggleArrayValue = useCallback(
    (fieldId: string, value: string) => {
      setFormData((prev) => {
        const arr = (prev[fieldId] as string[]) || [];
        return {
          ...prev,
          [fieldId]: arr.includes(value)
            ? arr.filter((v) => v !== value)
            : [...arr, value],
        };
      });
    },
    []
  );

  // ─── Validation ───

  const validateStep = useCallback(
    (stepIndex: number): boolean => {
      const step = steps[stepIndex];
      for (const field of step.fields) {
        if (!field.required) continue;
        const val = formData[field.id];
        if (val === undefined || val === null || val === "") return false;
        if (Array.isArray(val) && val.length === 0) return false;
      }
      return true;
    },
    [steps, formData]
  );

  // ─── Navigation ───

  const goNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep, totalSteps]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const duration = Math.round((Date.now() - startTime) / 1000);
      const payload = { ...formData, _duration_seconds: duration };

      if (onSubmit) {
        await onSubmit(payload);
      } else {
        // Default: POST to API
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
          }),
        });
      }
      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  }, [formData, onSubmit, surveyId, startTime]);

  // ─── Render field ───

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
              className="civiq-input"
            />
          );

        case "textarea":
          return (
            <textarea
              value={(value as string) || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="civiq-input civiq-textarea"
              rows={4}
            />
          );

        case "select":
          return (
            <select
              value={(value as string) || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              className="civiq-input civiq-select"
            >
              <option value="">— Sélectionner —</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          );

        case "radio":
          return (
            <div className="civiq-options">
              {field.options?.map((opt) => (
                <label
                  key={opt.value}
                  className={`civiq-option-card ${
                    value === opt.value ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name={field.id}
                    value={opt.value}
                    checked={value === opt.value}
                    onChange={() => setValue(field.id, opt.value)}
                  />
                  <div className="civiq-option-label">
                    <strong>{opt.label}</strong>
                    {opt.sublabel && <span>{opt.sublabel}</span>}
                  </div>
                </label>
              ))}
            </div>
          );

        case "checkbox":
        case "checkbox_grid":
          const arrVal = (value as string[]) || [];
          return (
            <div
              className={`civiq-options ${
                field.columns === 2 ? "civiq-grid-2" : ""
              }`}
            >
              {field.options?.map((opt) => (
                <label
                  key={opt.value}
                  className={`civiq-option-card ${
                    arrVal.includes(opt.value) ? "selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={arrVal.includes(opt.value)}
                    onChange={() => toggleArrayValue(field.id, opt.value)}
                  />
                  <div className="civiq-option-label">
                    <strong>{opt.label}</strong>
                    {opt.sublabel && <span>{opt.sublabel}</span>}
                  </div>
                </label>
              ))}
            </div>
          );

        case "scale":
          return (
            <div>
              <div className="civiq-scale-row">
                {Array.from(
                  { length: (field.max || 5) - (field.min || 1) + 1 },
                  (_, i) => (field.min || 1) + i
                ).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`civiq-scale-btn ${
                      value === n ? "selected" : ""
                    }`}
                    onClick={() => setValue(field.id, n)}
                    style={{
                      ...(value === n
                        ? { background: primaryColor, borderColor: primaryColor, color: "#fff" }
                        : {}),
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {(field.min_label || field.max_label) && (
                <div className="civiq-scale-labels">
                  <span>{field.min_label}</span>
                  <span>{field.max_label}</span>
                </div>
              )}
            </div>
          );

        case "number":
          return (
            <input
              type="number"
              value={(value as number) ?? ""}
              onChange={(e) =>
                setValue(field.id, e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              className="civiq-input"
              style={{ maxWidth: 200 }}
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
              className="civiq-input"
              style={{ maxWidth: 240 }}
            />
          );

        default:
          return null;
      }
    },
    [formData, setValue, toggleArrayValue, primaryColor]
  );

  // ─── Thank you screen ───

  if (submitted) {
    return (
      <div className="civiq-thankyou">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="civiq-thankyou-check"
          style={{ background: primaryColor }}
        >
          <Check size={40} />
        </motion.div>
        <h2>Merci pour votre participation !</h2>
        <p>
          {thankYouText ||
            "Vos réponses ont bien été enregistrées. Elles seront analysées pour construire une offre adaptée à vos besoins."}
        </p>
      </div>
    );
  }

  // ─── Main render ───

  const step = steps[currentStep];
  const isLast = currentStep === totalSteps - 1;
  const canProceed = validateStep(currentStep);

  return (
    <div className="civiq-survey">
      {/* Progress */}
      <div className="civiq-progress">
        <div className="civiq-progress-bar">
          <div
            className="civiq-progress-fill"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})`,
            }}
          />
        </div>
        <span className="civiq-progress-label">
          Étape {currentStep + 1} / {totalSteps}
        </span>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="civiq-step"
        >
          <div className="civiq-step-header">
            <h2>{step.title}</h2>
            {step.description && <p>{step.description}</p>}
          </div>

          <div className="civiq-step-body">
            {step.fields.map((field) => {
              // Conditional display
              if (field.conditional) {
                const depVal = formData[field.conditional.field];
                const show = Array.isArray(field.conditional.value)
                  ? field.conditional.value.includes(depVal as string)
                  : depVal === field.conditional.value;
                if (!show) return null;
              }

              return (
                <div key={field.id} className="civiq-field">
                  <label className="civiq-field-label">
                    {field.label}
                    {field.required && (
                      <span className="civiq-required">*</span>
                    )}
                  </label>
                  {field.hint && (
                    <p className="civiq-field-hint">{field.hint}</p>
                  )}
                  {renderField(field)}
                </div>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="civiq-nav">
        {currentStep > 0 ? (
          <button type="button" className="civiq-btn secondary" onClick={goPrev}>
            <ChevronLeft size={18} /> Retour
          </button>
        ) : (
          <div />
        )}

        {isLast ? (
          <button
            type="button"
            className="civiq-btn submit"
            style={{ background: accentColor, color: primaryColor }}
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Envoi…" : "Envoyer mes réponses"} <Check size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="civiq-btn primary"
            style={{ background: primaryColor }}
            onClick={goNext}
          >
            Continuer <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
