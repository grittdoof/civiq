"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import SurveyBuilder from "@/components/survey/SurveyBuilder";
import type { Survey, SurveySchema } from "@/types/survey";
import {
  ArrowLeft,
  Save,
  Eye,
  Globe,
  EyeOff,
  Loader2,
  Check,
} from "lucide-react";
import Link from "next/link";

// ═══════════════════════════════════════════════════
// EDIT SURVEY PAGE — Éditeur complet d'un sondage
// Charge le sondage, expose le SurveyBuilder, sauvegarde
// ═══════════════════════════════════════════════════

type SaveState = "idle" | "saving" | "saved" | "error";

export default function EditSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [schema, setSchema] = useState<SurveySchema>({ steps: [], settings: {} });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [status, setStatus] = useState<Survey["status"]>("draft");
  const [customThankYou, setCustomThankYou] = useState("");
  const [customHeaderText, setCustomHeaderText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    loadSurvey();
  }, [surveyId]);

  async function loadSurvey() {
    const supabase = createClient();
    const { data } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", surveyId)
      .single();

    if (data) {
      setSurvey(data as Survey);
      setSchema((data as Survey).schema);
      setTitle((data as Survey).title);
      setDescription((data as Survey).description || "");
      setEndsAt(
        (data as Survey).ends_at
          ? new Date((data as Survey).ends_at!).toISOString().slice(0, 16)
          : ""
      );
      setStatus((data as Survey).status);
      setCustomThankYou((data as Survey).custom_thank_you || "");
      setCustomHeaderText((data as Survey).custom_header_text || "");
    }
    setLoading(false);
  }

  const handleSave = useCallback(
    async (newStatus?: Survey["status"]) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/surveys/${surveyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            schema,
            status: newStatus || status,
            ends_at: endsAt || null,
            custom_thank_you: customThankYou.trim() || null,
            custom_header_text: customHeaderText.trim() || null,
          }),
        });

        if (res.ok) {
          const updated = await res.json();
          setSurvey(updated);
          setStatus(updated.status);
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 2500);
        } else {
          setSaveState("error");
          setTimeout(() => setSaveState("idle"), 3000);
        }
      } catch {
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 3000);
      }
    },
    [surveyId, title, description, schema, status, endsAt, customThankYou, customHeaderText]
  );

  async function togglePublish() {
    const newStatus = status === "published" ? "closed" : "published";
    await handleSave(newStatus);
  }

  if (loading) {
    return (
      <div className="edit-loading">
        <Loader2 size={32} className="spin" />
        <p>Chargement de l'éditeur…</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="edit-loading">
        <p>Sondage introuvable.</p>
        <Link href="/admin/dashboard">← Retour au tableau de bord</Link>
      </div>
    );
  }

  return (
    <div className="edit-page">
      {/* Top bar */}
      <header className="edit-topbar">
        <div className="edit-topbar-left">
          <Link href="/admin/dashboard" className="edit-back">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="edit-title-input"
              placeholder="Titre du sondage"
            />
            <div className="edit-status-row">
              <span className={`edit-status-badge ${status}`}>
                {status === "draft" && "Brouillon"}
                {status === "published" && "Publié"}
                {status === "closed" && "Terminé"}
                {status === "archived" && "Archivé"}
              </span>
              {survey.slug && (
                <span className="edit-slug">/{survey.slug}</span>
              )}
            </div>
          </div>
        </div>

        <div className="edit-topbar-right">
          {status === "published" && (
            <a
              href={`/survey/${survey.slug}`}
              target="_blank"
              className="edit-btn secondary"
              rel="noreferrer"
            >
              <Eye size={15} /> Voir en ligne
            </a>
          )}

          <button
            type="button"
            onClick={togglePublish}
            className={`edit-btn ${status === "published" ? "warning" : "success"}`}
            disabled={saveState === "saving"}
          >
            {status === "published" ? (
              <>
                <EyeOff size={15} /> Dépublier
              </>
            ) : (
              <>
                <Globe size={15} /> Publier
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saveState === "saving"}
            className="edit-btn primary"
          >
            {saveState === "saving" && <Loader2 size={15} className="spin" />}
            {saveState === "saved" && <Check size={15} />}
            {saveState === "error" && "⚠ Erreur"}
            {saveState === "idle" && <Save size={15} />}
            {saveState === "saving"
              ? "Sauvegarde…"
              : saveState === "saved"
              ? "Sauvegardé !"
              : "Sauvegarder"}
          </button>
        </div>
      </header>

      <div className="edit-body">
        {/* Left: builder */}
        <main className="edit-main">
          <section className="edit-section">
            <h2 className="edit-section-title">Étapes & Questions</h2>
            <SurveyBuilder schema={schema} onChange={setSchema} />
          </section>
        </main>

        {/* Right: settings */}
        <aside className="edit-aside">
          <section className="edit-section">
            <h3 className="edit-aside-title">Paramètres du sondage</h3>

            <div className="edit-field">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'objectif de ce sondage…"
                rows={3}
                className="edit-input edit-textarea"
              />
            </div>

            <div className="edit-field">
              <label>Date de clôture</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="edit-input"
              />
              <p className="edit-field-hint">
                Le sondage n'acceptera plus de réponses après cette date.
              </p>
            </div>

            <div className="edit-field">
              <label>Titre dans l'en-tête (optionnel)</label>
              <input
                type="text"
                value={customHeaderText}
                onChange={(e) => setCustomHeaderText(e.target.value)}
                placeholder="Par défaut : titre du sondage"
                className="edit-input"
              />
            </div>

            <div className="edit-field">
              <label>Message de remerciement personnalisé</label>
              <textarea
                value={customThankYou}
                onChange={(e) => setCustomThankYou(e.target.value)}
                placeholder="Merci pour votre participation ! Vos réponses seront analysées…"
                rows={3}
                className="edit-input edit-textarea"
              />
            </div>
          </section>

          {/* Infos */}
          <section className="edit-section edit-info-section">
            <h3 className="edit-aside-title">Informations</h3>
            <div className="edit-info-row">
              <span>Créé le</span>
              <strong>
                {new Date(survey.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </strong>
            </div>
            {survey.published_at && (
              <div className="edit-info-row">
                <span>Publié le</span>
                <strong>
                  {new Date(survey.published_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
              </div>
            )}
            <div className="edit-info-row">
              <span>Étapes</span>
              <strong>{schema.steps.length}</strong>
            </div>
            <div className="edit-info-row">
              <span>Champs</span>
              <strong>
                {schema.steps.reduce((n, s) => n + s.fields.length, 0)}
              </strong>
            </div>
            <div className="edit-info-row">
              <span>Lien public</span>
              <a
                href={`/survey/${survey.slug}`}
                target="_blank"
                rel="noreferrer"
                className="edit-info-link"
              >
                /survey/{survey.slug}
              </a>
            </div>
          </section>
        </aside>
      </div>

      <style>{`
        .edit-page {
          min-height: 100vh;
          background: #f2efe8;
          font-family: 'Source Sans 3', -apple-system, sans-serif;
        }

        /* ─── Loading ─── */
        .edit-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          color: #888;
          gap: 16px;
          font-size: 15px;
        }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ─── Top bar ─── */
        .edit-topbar {
          position: sticky;
          top: 0;
          z-index: 50;
          background: #fff;
          border-bottom: 2px solid #e8e5de;
          padding: 12px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .edit-topbar-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
        .edit-back {
          width: 36px; height: 36px;
          border: 2px solid #e8e5de;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          color: #888;
          flex-shrink: 0;
          transition: 0.2s;
        }
        .edit-back:hover { border-color: #3b6fa0; color: #3b6fa0; }

        .edit-title-input {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 700;
          color: #1a2744;
          border: none;
          outline: none;
          background: transparent;
          width: 100%;
          max-width: 400px;
          padding: 2px 6px;
          border-radius: 4px;
          transition: 0.15s;
        }
        .edit-title-input:hover { background: #f2efe8; }
        .edit-title-input:focus { background: #f2efe8; }

        .edit-status-row { display: flex; align-items: center; gap: 8px; margin-top: 2px; padding-left: 6px; }
        .edit-status-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .edit-status-badge.draft { background: #f5f5f5; color: #888; }
        .edit-status-badge.published { background: #e8f5e9; color: #2e7d32; }
        .edit-status-badge.closed { background: #fff3e0; color: #e65100; }
        .edit-status-badge.archived { background: #fce4ec; color: #c62828; }
        .edit-slug { font-size: 12px; color: #bbb; font-family: monospace; }

        .edit-topbar-right { display: flex; align-items: center; gap: 8px; }
        .edit-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: 0.2s;
          text-decoration: none;
          font-family: inherit;
          white-space: nowrap;
        }
        .edit-btn.primary {
          background: linear-gradient(135deg, #1a2744, #3b6fa0);
          color: #fff;
          box-shadow: 0 2px 10px rgba(26,39,68,0.2);
        }
        .edit-btn.primary:hover { box-shadow: 0 4px 15px rgba(26,39,68,0.3); transform: translateY(-1px); }
        .edit-btn.secondary {
          background: #fff;
          color: #1a2744;
          border: 1.5px solid #e8e5de;
        }
        .edit-btn.secondary:hover { border-color: #3b6fa0; color: #3b6fa0; }
        .edit-btn.success { background: #e8f5e9; color: #2e7d32; border: 1.5px solid #c8e6c9; }
        .edit-btn.success:hover { background: #c8e6c9; }
        .edit-btn.warning { background: #fff3e0; color: #e65100; border: 1.5px solid #ffcc80; }
        .edit-btn.warning:hover { background: #ffcc80; }
        .edit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }

        /* ─── Body layout ─── */
        .edit-body {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 24px;
          padding: 24px;
          max-width: 1300px;
          margin: 0 auto;
          align-items: start;
        }
        @media (max-width: 900px) {
          .edit-body { grid-template-columns: 1fr; }
        }

        /* ─── Sections ─── */
        .edit-section {
          background: #fff;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.04);
          margin-bottom: 16px;
        }
        .edit-section-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 700;
          color: #1a2744;
          margin-bottom: 20px;
        }
        .edit-aside-title {
          font-size: 14px;
          font-weight: 700;
          color: #1a2744;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 16px;
        }

        /* ─── Fields ─── */
        .edit-field { margin-bottom: 16px; }
        .edit-field label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 6px;
        }
        .edit-input {
          width: 100%;
          padding: 10px 14px;
          border: 2px solid #e8e5de;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          color: #1a2744;
          background: #fff;
          outline: none;
          transition: 0.15s;
          box-sizing: border-box;
        }
        .edit-input:focus { border-color: #3b6fa0; box-shadow: 0 0 0 3px rgba(59,111,160,0.1); }
        .edit-textarea { resize: vertical; min-height: 80px; }
        .edit-field-hint { font-size: 11px; color: #aaa; margin-top: 4px; line-height: 1.4; }

        /* ─── Info section ─── */
        .edit-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f2efe8;
          font-size: 13px;
        }
        .edit-info-row:last-child { border-bottom: none; }
        .edit-info-row span { color: #888; }
        .edit-info-row strong { color: #1a2744; font-weight: 600; }
        .edit-info-link { color: #3b6fa0; text-decoration: none; font-size: 12px; font-family: monospace; }
        .edit-info-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
