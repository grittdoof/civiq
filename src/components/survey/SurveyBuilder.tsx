"use client";

import { useState, useCallback } from "react";
import type { SurveySchema, SurveyStep, SurveyField, FieldType, FieldOption } from "@/types/survey";
import { Plus, Trash2, ChevronUp, ChevronDown, Settings, GripVertical, X } from "lucide-react";

// ═══════════════════════════════════════════════════
// SURVEY BUILDER — Éditeur visuel de schema de sondage
// Permet de créer/modifier des étapes et des champs
// ═══════════════════════════════════════════════════

interface SurveyBuilderProps {
  schema: SurveySchema;
  onChange: (schema: SurveySchema) => void;
}

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: "text", label: "Texte court", icon: "Aa" },
  { value: "textarea", label: "Texte long", icon: "¶" },
  { value: "email", label: "Email", icon: "@" },
  { value: "tel", label: "Téléphone", icon: "☎" },
  { value: "number", label: "Nombre", icon: "123" },
  { value: "date", label: "Date", icon: "📅" },
  { value: "select", label: "Liste déroulante", icon: "▾" },
  { value: "radio", label: "Choix unique", icon: "◉" },
  { value: "checkbox", label: "Choix multiples", icon: "☑" },
  { value: "checkbox_grid", label: "Grille de cases", icon: "⊞" },
  { value: "scale", label: "Échelle", icon: "⭐" },
];

const TYPES_WITH_OPTIONS: FieldType[] = ["select", "radio", "checkbox", "checkbox_grid"];

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function newField(): SurveyField {
  return {
    id: `field_${generateId()}`,
    type: "radio",
    label: "Nouvelle question",
    required: false,
    options: [
      { value: "oui", label: "Oui" },
      { value: "non", label: "Non" },
    ],
  };
}

function newStep(): SurveyStep {
  return {
    id: `step_${generateId()}`,
    title: "Nouvelle étape",
    fields: [],
  };
}

// ─── Field Editor (inline) ───

interface FieldEditorProps {
  field: SurveyField;
  allFields: SurveyField[];
  onChange: (field: SurveyField) => void;
  onClose: () => void;
}

function FieldEditor({ field, allFields, onChange, onClose }: FieldEditorProps) {
  const hasOptions = TYPES_WITH_OPTIONS.includes(field.type);
  const isScale = field.type === "scale";
  const isNumeric = field.type === "number" || field.type === "scale";

  function updateField(updates: Partial<SurveyField>) {
    onChange({ ...field, ...updates });
  }

  function addOption() {
    const opts = field.options || [];
    const idx = opts.length + 1;
    onChange({
      ...field,
      options: [
        ...opts,
        { value: `option_${idx}`, label: `Option ${idx}` },
      ],
    });
  }

  function updateOption(i: number, updates: Partial<FieldOption>) {
    const opts = [...(field.options || [])];
    opts[i] = { ...opts[i], ...updates };
    onChange({ ...field, options: opts });
  }

  function removeOption(i: number) {
    const opts = [...(field.options || [])];
    opts.splice(i, 1);
    onChange({ ...field, options: opts });
  }

  // Other fields that can be used as conditions
  const conditionableFields = allFields.filter(
    (f) => f.id !== field.id && TYPES_WITH_OPTIONS.includes(f.type)
  );

  return (
    <div className="sb-field-editor">
      <div className="sb-editor-header">
        <h4>Modifier le champ</h4>
        <button type="button" onClick={onClose} className="sb-editor-close">
          <X size={16} />
        </button>
      </div>

      <div className="sb-editor-body">
        {/* Type */}
        <div className="sb-editor-row">
          <label>Type de champ</label>
          <select
            value={field.type}
            onChange={(e) => {
              const type = e.target.value as FieldType;
              const updates: Partial<SurveyField> = { type };
              if (TYPES_WITH_OPTIONS.includes(type) && !field.options?.length) {
                updates.options = [
                  { value: "oui", label: "Oui" },
                  { value: "non", label: "Non" },
                ];
              }
              if (type === "scale") {
                updates.min = field.min ?? 1;
                updates.max = field.max ?? 5;
              }
              updateField(updates);
            }}
            className="sb-editor-input"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Label */}
        <div className="sb-editor-row">
          <label>Libellé de la question *</label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => updateField({ label: e.target.value })}
            className="sb-editor-input"
            placeholder="Entrez la question…"
          />
        </div>

        {/* Hint */}
        <div className="sb-editor-row">
          <label>Indication (facultatif)</label>
          <input
            type="text"
            value={field.hint || ""}
            onChange={(e) => updateField({ hint: e.target.value || undefined })}
            className="sb-editor-input"
            placeholder="Texte d'aide sous la question…"
          />
        </div>

        {/* Placeholder (for text/number/date/select) */}
        {["text", "textarea", "email", "tel", "number", "date"].includes(field.type) && (
          <div className="sb-editor-row">
            <label>Placeholder</label>
            <input
              type="text"
              value={field.placeholder || ""}
              onChange={(e) => updateField({ placeholder: e.target.value || undefined })}
              className="sb-editor-input"
              placeholder="Texte indicatif dans le champ…"
            />
          </div>
        )}

        {/* Required */}
        <div className="sb-editor-row sb-editor-checkbox-row">
          <label>
            <input
              type="checkbox"
              checked={!!field.required}
              onChange={(e) => updateField({ required: e.target.checked })}
            />
            Réponse obligatoire
          </label>
        </div>

        {/* Columns (checkbox_grid) */}
        {field.type === "checkbox_grid" && (
          <div className="sb-editor-row">
            <label>Colonnes</label>
            <select
              value={field.columns || 1}
              onChange={(e) => updateField({ columns: Number(e.target.value) })}
              className="sb-editor-input"
              style={{ maxWidth: 100 }}
            >
              <option value={1}>1 colonne</option>
              <option value={2}>2 colonnes</option>
            </select>
          </div>
        )}

        {/* Scale min/max */}
        {isScale && (
          <>
            <div className="sb-editor-row-inline">
              <div className="sb-editor-row" style={{ flex: 1 }}>
                <label>Valeur min</label>
                <input
                  type="number"
                  value={field.min ?? 1}
                  onChange={(e) => updateField({ min: Number(e.target.value) })}
                  className="sb-editor-input"
                />
              </div>
              <div className="sb-editor-row" style={{ flex: 1 }}>
                <label>Valeur max</label>
                <input
                  type="number"
                  value={field.max ?? 5}
                  onChange={(e) => updateField({ max: Number(e.target.value) })}
                  className="sb-editor-input"
                />
              </div>
            </div>
            <div className="sb-editor-row-inline">
              <div className="sb-editor-row" style={{ flex: 1 }}>
                <label>Label min</label>
                <input
                  type="text"
                  value={field.min_label || ""}
                  onChange={(e) => updateField({ min_label: e.target.value || undefined })}
                  className="sb-editor-input"
                  placeholder="Ex: Pas du tout"
                />
              </div>
              <div className="sb-editor-row" style={{ flex: 1 }}>
                <label>Label max</label>
                <input
                  type="text"
                  value={field.max_label || ""}
                  onChange={(e) => updateField({ max_label: e.target.value || undefined })}
                  className="sb-editor-input"
                  placeholder="Ex: Tout à fait"
                />
              </div>
            </div>
          </>
        )}

        {/* Number min/max */}
        {field.type === "number" && (
          <div className="sb-editor-row-inline">
            <div className="sb-editor-row" style={{ flex: 1 }}>
              <label>Min (facultatif)</label>
              <input
                type="number"
                value={field.min ?? ""}
                onChange={(e) => updateField({ min: e.target.value ? Number(e.target.value) : undefined })}
                className="sb-editor-input"
              />
            </div>
            <div className="sb-editor-row" style={{ flex: 1 }}>
              <label>Max (facultatif)</label>
              <input
                type="number"
                value={field.max ?? ""}
                onChange={(e) => updateField({ max: e.target.value ? Number(e.target.value) : undefined })}
                className="sb-editor-input"
              />
            </div>
          </div>
        )}

        {/* Options (radio/checkbox/select/checkbox_grid) */}
        {hasOptions && (
          <div className="sb-editor-options">
            <label>Options de réponse</label>
            {(field.options || []).map((opt, i) => (
              <div key={i} className="sb-option-row">
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => updateOption(i, { label: e.target.value })}
                  className="sb-editor-input sb-option-label"
                  placeholder="Libellé"
                />
                <input
                  type="text"
                  value={opt.value}
                  onChange={(e) => updateOption(i, { value: e.target.value })}
                  className="sb-editor-input sb-option-value"
                  placeholder="Valeur"
                />
                <input
                  type="text"
                  value={opt.sublabel || ""}
                  onChange={(e) => updateOption(i, { sublabel: e.target.value || undefined })}
                  className="sb-editor-input sb-option-sublabel"
                  placeholder="Sous-titre"
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="sb-option-del"
                  disabled={(field.options || []).length <= 1}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addOption} className="sb-add-option-btn">
              <Plus size={14} /> Ajouter une option
            </button>
          </div>
        )}

        {/* Conditional display */}
        {conditionableFields.length > 0 && (
          <div className="sb-editor-conditional">
            <label>Affichage conditionnel</label>
            <p className="sb-conditional-hint">
              N'afficher ce champ que si un autre champ a une certaine valeur.
            </p>
            <div className="sb-editor-row-inline">
              <select
                value={field.conditional?.field || ""}
                onChange={(e) => {
                  if (!e.target.value) {
                    updateField({ conditional: undefined });
                  } else {
                    updateField({
                      conditional: {
                        field: e.target.value,
                        value: field.conditional?.value || "",
                      },
                    });
                  }
                }}
                className="sb-editor-input"
                style={{ flex: 2 }}
              >
                <option value="">Toujours visible</option>
                {conditionableFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label.slice(0, 50)}
                  </option>
                ))}
              </select>
              {field.conditional?.field && (
                <input
                  type="text"
                  value={
                    Array.isArray(field.conditional.value)
                      ? field.conditional.value.join(",")
                      : field.conditional.value
                  }
                  onChange={(e) => {
                    const vals = e.target.value.split(",").map((v) => v.trim()).filter(Boolean);
                    updateField({
                      conditional: {
                        field: field.conditional!.field,
                        value: vals.length === 1 ? vals[0] : vals,
                      },
                    });
                  }}
                  className="sb-editor-input"
                  style={{ flex: 1 }}
                  placeholder="valeur1,valeur2"
                />
              )}
            </div>
            {field.conditional?.field && (
              <p className="sb-conditional-hint" style={{ marginTop: 4 }}>
                Valeurs séparées par des virgules pour autoriser plusieurs réponses.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step Panel ───

interface StepPanelProps {
  step: SurveyStep;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (step: SurveyStep) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function StepPanel({
  step,
  isSelected,
  onSelect,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
}: StepPanelProps) {
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  function addField() {
    const field = newField();
    onUpdate({ ...step, fields: [...step.fields, field] });
    setEditingFieldId(field.id);
  }

  function updateField(fieldId: string, updated: SurveyField) {
    onUpdate({
      ...step,
      fields: step.fields.map((f) => (f.id === fieldId ? updated : f)),
    });
  }

  function deleteField(fieldId: string) {
    setEditingFieldId(null);
    onUpdate({ ...step, fields: step.fields.filter((f) => f.id !== fieldId) });
  }

  function moveField(fieldId: string, dir: -1 | 1) {
    const idx = step.fields.findIndex((f) => f.id === fieldId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= step.fields.length) return;
    const fields = [...step.fields];
    [fields[idx], fields[newIdx]] = [fields[newIdx], fields[idx]];
    onUpdate({ ...step, fields });
  }

  const typeLabel = (type: FieldType) =>
    FIELD_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div className={`sb-step-panel ${isSelected ? "selected" : ""}`}>
      <div className="sb-step-header" onClick={onSelect}>
        <div className="sb-step-drag">
          <GripVertical size={16} />
        </div>
        <div className="sb-step-title">
          <span className="sb-step-icon">{step.icon || "📋"}</span>
          <div>
            <strong>{step.title}</strong>
            <span className="sb-step-meta">{step.fields.length} champ{step.fields.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="sb-step-actions">
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={!canMoveUp} className="sb-icon-btn" title="Monter">
            <ChevronUp size={14} />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={!canMoveDown} className="sb-icon-btn" title="Descendre">
            <ChevronDown size={14} />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="sb-icon-btn danger" title="Supprimer l'étape">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isSelected && (
        <div className="sb-step-body">
          {/* Step metadata */}
          <div className="sb-step-meta-edit">
            <div className="sb-meta-row">
              <input
                type="text"
                value={step.title}
                onChange={(e) => onUpdate({ ...step, title: e.target.value })}
                className="sb-meta-input"
                placeholder="Titre de l'étape"
              />
              <input
                type="text"
                value={step.icon || ""}
                onChange={(e) => onUpdate({ ...step, icon: e.target.value || undefined })}
                className="sb-meta-input sb-icon-input"
                placeholder="🏠"
                maxLength={4}
              />
            </div>
            <input
              type="text"
              value={step.description || ""}
              onChange={(e) => onUpdate({ ...step, description: e.target.value || undefined })}
              className="sb-meta-input"
              placeholder="Description de l'étape (facultatif)"
            />
          </div>

          {/* Fields */}
          <div className="sb-fields-list">
            {step.fields.length === 0 && (
              <p className="sb-empty-fields">
                Aucun champ — cliquez sur &quot;Ajouter un champ&quot; pour commencer.
              </p>
            )}

            {step.fields.map((field, fi) => (
              <div key={field.id} className="sb-field-item-wrap">
                <div className="sb-field-item">
                  <div className="sb-field-info">
                    <span className="sb-field-type-badge">{typeLabel(field.type)}</span>
                    <span className="sb-field-label">{field.label}</span>
                    {field.required && <span className="sb-required-badge">obligatoire</span>}
                    {field.conditional && (
                      <span className="sb-conditional-badge">conditionnel</span>
                    )}
                  </div>
                  <div className="sb-field-actions">
                    <button
                      type="button"
                      onClick={() => moveField(field.id, -1)}
                      disabled={fi === 0}
                      className="sb-icon-btn"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(field.id, 1)}
                      disabled={fi === step.fields.length - 1}
                      className="sb-icon-btn"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingFieldId((id) => (id === field.id ? null : field.id))
                      }
                      className={`sb-icon-btn ${editingFieldId === field.id ? "active" : ""}`}
                      title="Modifier le champ"
                    >
                      <Settings size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteField(field.id)}
                      className="sb-icon-btn danger"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {editingFieldId === field.id && (
                  <FieldEditor
                    field={field}
                    allFields={step.fields}
                    onChange={(updated) => updateField(field.id, updated)}
                    onClose={() => setEditingFieldId(null)}
                  />
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={addField} className="sb-add-field-btn">
            <Plus size={16} /> Ajouter un champ
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main SurveyBuilder ───

export default function SurveyBuilder({ schema, onChange }: SurveyBuilderProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    schema.steps[0]?.id || null
  );

  const updateStep = useCallback(
    (stepId: string, updated: SurveyStep) => {
      onChange({
        ...schema,
        steps: schema.steps.map((s) => (s.id === stepId ? updated : s)),
      });
    },
    [schema, onChange]
  );

  function addStep() {
    const step = newStep();
    onChange({ ...schema, steps: [...schema.steps, step] });
    setSelectedStepId(step.id);
  }

  function deleteStep(stepId: string) {
    const steps = schema.steps.filter((s) => s.id !== stepId);
    onChange({ ...schema, steps });
    if (selectedStepId === stepId) {
      setSelectedStepId(steps[0]?.id || null);
    }
  }

  function moveStep(stepId: string, dir: -1 | 1) {
    const idx = schema.steps.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= schema.steps.length) return;
    const steps = [...schema.steps];
    [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
    onChange({ ...schema, steps });
  }

  return (
    <div className="sb-builder">
      <div className="sb-builder-header">
        <div>
          <strong>{schema.steps.length} étape{schema.steps.length !== 1 ? "s" : ""}</strong>
          <span className="sb-builder-meta">
            {schema.steps.reduce((n, s) => n + s.fields.length, 0)} champs au total
          </span>
        </div>
        <div className="sb-builder-settings">
          <label className="sb-settings-checkbox">
            <input
              type="checkbox"
              checked={schema.settings.show_progress !== false}
              onChange={(e) =>
                onChange({
                  ...schema,
                  settings: { ...schema.settings, show_progress: e.target.checked },
                })
              }
            />
            Barre de progression
          </label>
          <label className="sb-settings-checkbox">
            <input
              type="checkbox"
              checked={!!schema.settings.allow_anonymous}
              onChange={(e) =>
                onChange({
                  ...schema,
                  settings: { ...schema.settings, allow_anonymous: e.target.checked },
                })
              }
            />
            Réponses anonymes
          </label>
          <input
            type="text"
            value={schema.settings.estimated_time || ""}
            onChange={(e) =>
              onChange({
                ...schema,
                settings: { ...schema.settings, estimated_time: e.target.value || undefined },
              })
            }
            placeholder="Durée estimée (ex: 5 min)"
            className="sb-duration-input"
          />
        </div>
      </div>

      <div className="sb-steps-list">
        {schema.steps.map((step, si) => (
          <StepPanel
            key={step.id}
            step={step}
            isSelected={selectedStepId === step.id}
            onSelect={() => setSelectedStepId(step.id)}
            onUpdate={(updated) => updateStep(step.id, updated)}
            onMoveUp={() => moveStep(step.id, -1)}
            onMoveDown={() => moveStep(step.id, 1)}
            onDelete={() => deleteStep(step.id)}
            canMoveUp={si > 0}
            canMoveDown={si < schema.steps.length - 1}
          />
        ))}

        <button type="button" onClick={addStep} className="sb-add-step-btn">
          <Plus size={18} /> Ajouter une étape
        </button>
      </div>

      <style>{`
        .sb-builder {
          font-family: 'Source Sans 3', -apple-system, sans-serif;
        }

        /* ─── Header ─── */
        .sb-builder-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0;
          margin-bottom: 16px;
          border-bottom: 2px solid #e8e5de;
          flex-wrap: wrap;
          gap: 12px;
        }
        .sb-builder-header strong { font-size: 16px; color: #1a2744; margin-right: 8px; }
        .sb-builder-meta { font-size: 13px; color: #999; }
        .sb-builder-settings { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .sb-settings-checkbox {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #666;
          cursor: pointer;
        }
        .sb-settings-checkbox input { accent-color: #3b6fa0; }
        .sb-duration-input {
          padding: 6px 12px;
          border: 1.5px solid #e8e5de;
          border-radius: 6px;
          font-size: 13px;
          outline: none;
          width: 180px;
        }
        .sb-duration-input:focus { border-color: #3b6fa0; }

        /* ─── Steps list ─── */
        .sb-steps-list { display: flex; flex-direction: column; gap: 8px; }

        /* ─── Step panel ─── */
        .sb-step-panel {
          border: 2px solid #e8e5de;
          border-radius: 10px;
          background: #fff;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .sb-step-panel.selected { border-color: #3b6fa0; }

        .sb-step-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          cursor: pointer;
          user-select: none;
        }
        .sb-step-header:hover { background: #faf9f6; }
        .sb-step-panel.selected .sb-step-header { background: #f0f7ff; }

        .sb-step-drag { color: #ccc; cursor: grab; }
        .sb-step-title { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .sb-step-icon { font-size: 20px; }
        .sb-step-title strong { display: block; font-size: 15px; color: #1a2744; }
        .sb-step-meta { font-size: 12px; color: #aaa; }

        .sb-step-actions { display: flex; gap: 4px; }
        .sb-icon-btn {
          width: 28px; height: 28px;
          border: 1.5px solid #e8e5de;
          background: #fff;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #888;
          transition: 0.15s;
        }
        .sb-icon-btn:hover:not(:disabled) { border-color: #3b6fa0; color: #3b6fa0; }
        .sb-icon-btn.active { border-color: #3b6fa0; color: #3b6fa0; background: #f0f7ff; }
        .sb-icon-btn.danger:hover:not(:disabled) { border-color: #e53e3e; color: #e53e3e; }
        .sb-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        /* ─── Step body ─── */
        .sb-step-body { padding: 16px; border-top: 1px solid #e8e5de; background: #fafafa; }

        .sb-step-meta-edit { margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
        .sb-meta-row { display: flex; gap: 8px; }
        .sb-meta-input {
          padding: 8px 12px;
          border: 1.5px solid #e8e5de;
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition: 0.15s;
          flex: 1;
        }
        .sb-meta-input:focus { border-color: #3b6fa0; }
        .sb-icon-input { max-width: 64px; text-align: center; font-size: 20px; }

        /* ─── Fields ─── */
        .sb-empty-fields {
          text-align: center;
          padding: 20px;
          color: #bbb;
          font-size: 14px;
          font-style: italic;
        }
        .sb-fields-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }

        .sb-field-item-wrap { border: 1.5px solid #e8e5de; border-radius: 8px; overflow: hidden; background: #fff; }
        .sb-field-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          min-width: 0;
        }
        .sb-field-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; flex-wrap: wrap; }
        .sb-field-type-badge {
          background: #f2efe8;
          color: #888;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .sb-field-label {
          font-size: 14px;
          color: #1a2744;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 280px;
        }
        .sb-required-badge {
          background: #fef2f2;
          color: #c62828;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .sb-conditional-badge {
          background: #e6f1fb;
          color: #1565c0;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .sb-field-actions { display: flex; gap: 4px; flex-shrink: 0; }

        /* ─── Add buttons ─── */
        .sb-add-field-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: 1.5px dashed #3b6fa0;
          border-radius: 6px;
          background: transparent;
          color: #3b6fa0;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.15s;
          font-family: inherit;
        }
        .sb-add-field-btn:hover { background: #f0f7ff; }

        .sb-add-step-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          border: 2px dashed #e8e5de;
          border-radius: 10px;
          background: transparent;
          color: #aaa;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
          font-family: inherit;
          margin-top: 4px;
        }
        .sb-add-step-btn:hover { border-color: #3b6fa0; color: #3b6fa0; background: #f0f7ff; }

        /* ─── Field Editor ─── */
        .sb-field-editor {
          border-top: 1px solid #e8e5de;
          background: #f8f9ff;
        }
        .sb-editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid #e8e5de;
          background: #e6f1fb;
        }
        .sb-editor-header h4 { font-size: 13px; font-weight: 600; color: #1a2744; }
        .sb-editor-close {
          width: 24px; height: 24px;
          border: none;
          background: none;
          cursor: pointer;
          color: #888;
          display: flex; align-items: center; justify-content: center;
          border-radius: 4px;
        }
        .sb-editor-close:hover { background: rgba(0,0,0,0.08); }
        .sb-editor-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }

        .sb-editor-row { display: flex; flex-direction: column; gap: 4px; }
        .sb-editor-row label {
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .sb-editor-input {
          padding: 8px 12px;
          border: 1.5px solid #e8e5de;
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
          background: #fff;
          outline: none;
          transition: 0.15s;
        }
        .sb-editor-input:focus { border-color: #3b6fa0; box-shadow: 0 0 0 2px rgba(59,111,160,0.1); }

        .sb-editor-checkbox-row label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
          color: #444;
          cursor: pointer;
        }
        .sb-editor-checkbox-row input { accent-color: #3b6fa0; width: 16px; height: 16px; }

        .sb-editor-row-inline { display: flex; gap: 12px; }

        /* ─── Options editor ─── */
        .sb-editor-options { display: flex; flex-direction: column; gap: 6px; }
        .sb-editor-options > label {
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 2px;
        }
        .sb-option-row { display: flex; gap: 6px; align-items: center; }
        .sb-option-label { flex: 3; }
        .sb-option-value { flex: 2; font-family: monospace; font-size: 12px; }
        .sb-option-sublabel { flex: 2; }
        .sb-option-del {
          width: 28px; height: 28px;
          border: 1.5px solid #e8e5de;
          background: #fff;
          border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: #bbb;
          flex-shrink: 0;
          transition: 0.15s;
        }
        .sb-option-del:hover:not(:disabled) { border-color: #e53e3e; color: #e53e3e; }
        .sb-option-del:disabled { opacity: 0.3; cursor: not-allowed; }
        .sb-add-option-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1.5px dashed #3b6fa0;
          border-radius: 6px;
          background: transparent;
          color: #3b6fa0;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          align-self: flex-start;
          font-family: inherit;
        }
        .sb-add-option-btn:hover { background: #f0f7ff; }

        /* ─── Conditional ─── */
        .sb-editor-conditional { display: flex; flex-direction: column; gap: 6px; }
        .sb-editor-conditional > label {
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .sb-conditional-hint { font-size: 11px; color: #aaa; }
      `}</style>
    </div>
  );
}
