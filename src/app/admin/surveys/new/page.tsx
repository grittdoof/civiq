"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { ArrowLeft, FileText, Sparkles, Plus } from "lucide-react";
import Link from "next/link";
import type { SurveyTemplate } from "@/types/survey";

export default function NewSurveyPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const supabase = createClient();
    const { data } = await supabase
      .from("survey_templates")
      .select("*")
      .eq("is_public", true)
      .order("title");

    if (data) setTemplates(data as SurveyTemplate[]);
    setLoading(false);
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          template_id: selectedTemplate,
        }),
      });

      if (res.ok) {
        const survey = await res.json();
        router.push(`/admin/surveys/${survey.id}`);
      }
    } catch (err) {
      console.error("Create error:", err);
    } finally {
      setCreating(false);
    }
  }

  const categoryIcons: Record<string, string> = {
    periscolaire: "🎒",
    budget: "💰",
    urbanisme: "🏗",
    satisfaction: "⭐",
    environnement: "🌱",
  };

  return (
    <div className="new-survey-page">
      <Link href="/admin/dashboard" className="back-link">
        <ArrowLeft size={16} /> Retour
      </Link>

      <h1>Nouveau sondage</h1>
      <p className="page-desc">
        Partez d'un modèle ou créez un sondage vierge que vous pourrez
        personnaliser.
      </p>

      {/* Title & description */}
      <div className="form-section">
        <label className="form-label">
          Titre du sondage <span className="req">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Besoins périscolaires 2026-2027"
          className="form-input"
        />

        <label className="form-label" style={{ marginTop: 16 }}>
          Description (facultatif)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Décrivez brièvement l'objectif de cette consultation…"
          className="form-input form-textarea"
          rows={3}
        />
      </div>

      {/* Templates */}
      <div className="form-section">
        <h2>Choisir un modèle</h2>

        <div className="templates-list">
          {/* Blank */}
          <div
            className={`template-option ${selectedTemplate === null ? "selected" : ""}`}
            onClick={() => setSelectedTemplate(null)}
          >
            <div className="template-icon blank">
              <Plus size={24} />
            </div>
            <div>
              <strong>Sondage vierge</strong>
              <span>Créer de zéro avec l'éditeur</span>
            </div>
          </div>

          {templates.map((t) => (
            <div
              key={t.id}
              className={`template-option ${selectedTemplate === t.id ? "selected" : ""}`}
              onClick={() => {
                setSelectedTemplate(t.id);
                if (!title.trim()) setTitle(t.title);
                if (!description.trim() && t.description) setDescription(t.description);
              }}
            >
              <div className="template-icon">
                {categoryIcons[t.category || ""] || "📋"}
              </div>
              <div>
                <strong>{t.title}</strong>
                <span>{t.description}</span>
                {t.category && (
                  <span className="template-cat">{t.category}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create button */}
      <div className="create-actions">
        <button
          onClick={handleCreate}
          disabled={!title.trim() || creating}
          className="create-btn"
        >
          {creating ? "Création…" : "Créer le sondage"}{" "}
          <Sparkles size={18} />
        </button>
      </div>

      <style>{`
        .new-survey-page {
          max-width: 700px;
          margin: 0 auto;
          padding: 32px 24px 60px;
          font-family: 'Source Sans 3', -apple-system, sans-serif;
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #888;
          text-decoration: none;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .back-link:hover { color: #3b6fa0; }

        h1 {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 700;
          color: #1a2744;
          margin-bottom: 8px;
        }
        .page-desc { color: #888; font-size: 15px; margin-bottom: 32px; }

        .form-section {
          margin-bottom: 32px;
        }
        .form-section h2 {
          font-size: 18px;
          font-weight: 600;
          color: #1a2744;
          margin-bottom: 16px;
        }
        .form-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #1a2744;
          margin-bottom: 6px;
        }
        .req { color: #c0392b; }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e8e5de;
          border-radius: 8px;
          font-family: inherit;
          font-size: 15px;
          color: #4a4a4a;
          background: #fff;
          outline: none;
          transition: 0.2s;
        }
        .form-input:focus { border-color: #3b6fa0; box-shadow: 0 0 0 3px rgba(59,111,160,0.1); }
        .form-textarea { resize: vertical; }

        .templates-list { display: grid; gap: 12px; }
        .template-option {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 18px 20px;
          border: 2px solid #e8e5de;
          border-radius: 10px;
          cursor: pointer;
          transition: 0.2s;
          background: #fff;
        }
        .template-option:hover { border-color: #5a8fbf; }
        .template-option.selected { border-color: #3b6fa0; background: rgba(59,111,160,0.04); }
        .template-icon {
          width: 48px; height: 48px;
          border-radius: 10px;
          background: #f2efe8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        .template-icon.blank { background: #e6f1fb; color: #3b6fa0; }
        .template-option strong { display: block; font-weight: 600; color: #1a2744; margin-bottom: 2px; }
        .template-option span { display: block; font-size: 13px; color: #888; line-height: 1.5; }
        .template-cat {
          display: inline-block;
          background: #f2efe8;
          color: #888;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 6px;
        }

        .create-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: 16px;
          border-top: 1px solid #e8e5de;
        }
        .create-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #1a2744, #3b6fa0);
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: 0.2s;
          box-shadow: 0 4px 15px rgba(26,39,68,0.2);
        }
        .create-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(26,39,68,0.3); }
        .create-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      `}</style>
    </div>
  );
}
