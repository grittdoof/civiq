"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  ArrowLeft,
  Download,
  Eye,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  BarChart3,
  Filter,
  ExternalLink,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import QrShare from "@/components/survey/QrShare";
import type { Survey, SurveyResponse, SurveyField } from "@/types/survey";

type TabKey = "overview" | "questions" | "funnel" | "responses";

interface QuestionAnalytics {
  field: SurveyField;
  totalAnswers: number;
  distribution: { label: string; value: number; pct: number }[];
}

interface FunnelStep {
  id: string;
  title: string;
  count: number;
  pct: number;
  drop: number;
}

interface TimelinePoint {
  date: string;
  day: string;
  count: number;
}

export default function SurveyResultsPage() {
  const params = useParams();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");
  const [commune, setCommune] = useState<{ slug: string } | null>(null);
  const [activeResponseIdx, setActiveResponseIdx] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [surveyRes, respRes, meRes] = await Promise.all([
        supabase.from("surveys").select("*").eq("id", surveyId).single(),
        supabase
          .from("responses")
          .select("*")
          .eq("survey_id", surveyId)
          .is("deleted_at", null)
          .order("submitted_at", { ascending: true }),
        fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (surveyRes.data) setSurvey(surveyRes.data as Survey);
      if (respRes.data) setResponses(respRes.data as SurveyResponse[]);
      if (meRes?.commune) setCommune(meRes.commune);
      setLoading(false);
    })();
  }, [surveyId]);

  const totalResponses = responses.length;

  const avgDuration = useMemo(() => {
    if (!totalResponses) return 0;
    const durations = responses
      .map((r) => r.duration_seconds || 0)
      .filter((d) => d > 0);
    if (!durations.length) return 0;
    return Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
  }, [responses, totalResponses]);

  const completionRate = useMemo(() => {
    if (!survey || !totalResponses) return 0;
    const lastStep = survey.schema.steps[survey.schema.steps.length - 1];
    if (!lastStep) return 0;
    const lastStepFields = lastStep.fields.map((f) => f.id);
    const completed = responses.filter((r) => {
      const data = r.data as Record<string, unknown>;
      return lastStepFields.some((fid) => {
        const v = data[fid];
        return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
      });
    }).length;
    return Math.round((completed / totalResponses) * 100);
  }, [survey, responses, totalResponses]);

  const estimatedViews = Math.max(totalResponses, Math.round(totalResponses / 0.62));

  const timeline = useMemo<TimelinePoint[]>(() => {
    const days: TimelinePoint[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({
        date: iso,
        day: d.toLocaleDateString("fr-FR", { weekday: "short" }),
        count: 0,
      });
    }
    for (const r of responses) {
      const iso = new Date(r.submitted_at).toISOString().slice(0, 10);
      const pt = days.find((d) => d.date === iso);
      if (pt) pt.count++;
    }
    return days;
  }, [responses]);

  const questions = useMemo<QuestionAnalytics[]>(() => {
    if (!survey) return [];
    const out: QuestionAnalytics[] = [];
    for (const step of survey.schema.steps) {
      for (const field of step.fields) {
        if (!["radio", "select", "checkbox", "checkbox_grid", "scale"].includes(field.type)) continue;
        const dist: Record<string, number> = {};
        if (field.options) field.options.forEach((o) => (dist[o.label] = 0));
        let totalAnswers = 0;
        for (const r of responses) {
          const val = (r.data as Record<string, unknown>)[field.id];
          if (val === undefined || val === null) continue;
          totalAnswers++;
          if (Array.isArray(val)) {
            for (const v of val) {
              const opt = field.options?.find((o) => o.value === v);
              const label = opt?.label || String(v);
              dist[label] = (dist[label] || 0) + 1;
            }
          } else {
            const opt = field.options?.find((o) => o.value === String(val));
            const label = opt?.label || String(val);
            dist[label] = (dist[label] || 0) + 1;
          }
        }
        const entries = Object.entries(dist)
          .map(([label, value]) => ({
            label,
            value,
            pct: totalAnswers ? Math.round((value / totalAnswers) * 100) : 0,
          }))
          .filter((d) => d.value > 0)
          .sort((a, b) => b.value - a.value);
        if (entries.length) {
          out.push({ field, totalAnswers, distribution: entries });
        }
      }
    }
    return out;
  }, [survey, responses]);

  const funnel = useMemo<FunnelStep[]>(() => {
    if (!survey) return [];
    const steps = survey.schema.steps;
    const counts: { id: string; title: string; count: number }[] = [
      { id: "__open", title: "Ouverture du sondage", count: estimatedViews },
    ];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const fieldIds = step.fields.map((f) => f.id);
      const count = responses.filter((r) => {
        const data = r.data as Record<string, unknown>;
        return fieldIds.some((fid) => {
          const v = data[fid];
          return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
        });
      }).length;
      counts.push({ id: step.id, title: `Étape ${i + 1} — ${step.title}`, count });
    }
    counts.push({ id: "__submit", title: "Sondage soumis", count: totalResponses });
    const base = counts[0].count || 1;
    return counts.map((c, i) => {
      const pct = Math.round((c.count / base) * 100);
      const prev = i === 0 ? c.count : counts[i - 1].count;
      const drop = prev ? Math.round(((prev - c.count) / prev) * 100) : 0;
      return { ...c, pct, drop };
    });
  }, [survey, responses, totalResponses, estimatedViews]);

  const abandonRate = funnel.length > 1 ? 100 - (funnel[funnel.length - 1]?.pct || 0) : 0;

  if (loading) {
    return (
      <main className="civiq-main" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div className="civiq-spin" style={{ width: 28, height: 28, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
      </main>
    );
  }

  if (!survey) {
    return <main className="civiq-main"><p>Sondage introuvable</p></main>;
  }

  const publicUrl = `/survey/${survey.slug}${commune ? `?commune=${commune.slug}` : ""}`;

  return (
    <main className="civiq-main">
      <Link
        href="/admin/dashboard"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Retour au tableau de bord
      </Link>

      {/* Header */}
      <div className="civiq-page-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <h1 className="civiq-page-title" style={{ margin: 0 }}>{survey.title}</h1>
            <span className={`civiq-badge ${survey.status === "published" ? "civiq-badge-success" : "civiq-badge-muted"}`}>
              {survey.status === "published" ? "Publié" : survey.status === "draft" ? "Brouillon" : survey.status === "closed" ? "Terminé" : "Archivé"}
            </span>
          </div>
          <a href={publicUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ExternalLink size={12} /> /survey/{survey.slug}
          </a>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <QrShare
            url={typeof window !== "undefined" ? `${window.location.origin}${publicUrl}` : publicUrl}
            title={survey.title}
            trigger="button"
          />
          <a href={publicUrl} target="_blank" rel="noreferrer" className="civiq-btn civiq-btn-outline">
            <Eye size={14} /> Aperçu
          </a>
          <a href={`/api/export?survey_id=${surveyId}&format=csv`} className="civiq-btn civiq-btn-outline">
            <Download size={14} /> CSV
          </a>
          <a href={`/api/export?survey_id=${surveyId}&format=xlsx`} className="civiq-btn civiq-btn-default">
            <FileSpreadsheet size={14} /> Exporter Excel
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {([
          { k: "overview", label: "Vue d'ensemble", icon: TrendingUp },
          { k: "questions", label: "Questions", icon: BarChart3 },
          { k: "funnel", label: "Entonnoir", icon: Filter },
          { k: "responses", label: `Réponses (${responses.length})`, icon: ListChecks },
        ] as const).map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${tab === k ? "var(--accent)" : "transparent"}`,
              color: tab === k ? "var(--accent)" : "var(--fg-muted)",
              cursor: "pointer",
              fontFamily: "inherit",
              marginBottom: -1,
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* KPIs */}
          <div className="civiq-stats-grid" style={{ marginBottom: 24 }}>
            <MetaCard
              icon={<Users size={18} />}
              iconBg="oklch(0.95 0.04 258)"
              value={totalResponses}
              label="Réponses totales"
              sub={`sur ${estimatedViews} vues`}
            />
            <MetaCard
              icon={<CheckCircle2 size={18} />}
              iconBg="oklch(0.95 0.06 155)"
              value={`${completionRate}%`}
              label="Taux de complétion"
              sub={totalResponses ? `${Math.round((completionRate / 100) * totalResponses)} complètes` : "—"}
            />
            <MetaCard
              icon={<Clock size={18} />}
              iconBg="oklch(0.95 0.05 30)"
              value={avgDuration ? formatDuration(avgDuration) : "—"}
              label="Durée moyenne"
              sub="par répondant"
            />
            <MetaCard
              icon={<Eye size={18} />}
              iconBg="oklch(0.95 0.04 285)"
              value={estimatedViews}
              label="Vues totales"
              sub="estimées"
            />
          </div>

          {/* Timeline */}
          <div className="civiq-card" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>Réponses par jour</h3>
                <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>7 derniers jours</p>
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                Total : <strong style={{ color: "var(--fg)" }}>{timeline.reduce((s, t) => s + t.count, 0)}</strong>
              </div>
            </div>
            <SparkLine points={timeline} />
          </div>

          {/* Top questions preview */}
          {questions.slice(0, 2).map((q) => (
            <QuestionCard key={q.field.id} q={q} />
          ))}
        </>
      )}

      {tab === "questions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {questions.length === 0 ? (
            <div className="civiq-card" style={{ textAlign: "center", padding: 48, borderStyle: "dashed" }}>
              <BarChart3 size={40} style={{ color: "var(--fg-xmuted)", margin: "0 auto 12px" }} strokeWidth={1.5} />
              <p style={{ fontSize: 14, color: "var(--fg-muted)" }}>Aucune donnée à analyser pour le moment</p>
            </div>
          ) : (
            questions.map((q) => <QuestionCard key={q.field.id} q={q} />)
          )}
        </div>
      )}

      {tab === "funnel" && (
        <>
          <div className="civiq-card" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>Entonnoir de complétion</h3>
              <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>Progression des répondants à travers les étapes du sondage</p>
            </div>
            <Funnel steps={funnel} />
          </div>

          <div className="civiq-stats-grid">
            <MetaCard icon={<Eye size={18} />} iconBg="oklch(0.95 0.04 258)" value={`${funnel[0]?.pct || 0}%`} label="Taux d'ouverture" sub={`${funnel[0]?.count || 0} vues`} />
            <MetaCard icon={<CheckCircle2 size={18} />} iconBg="oklch(0.95 0.06 155)" value={`${funnel[funnel.length - 1]?.pct || 0}%`} label="Taux de complétion" sub={`${funnel[funnel.length - 1]?.count || 0} complètes`} />
            <MetaCard icon={<TrendingUp size={18} />} iconBg="oklch(0.95 0.05 30)" value={`${abandonRate}%`} label="Abandons" sub="partiels" />
            <MetaCard icon={<Users size={18} />} iconBg="oklch(0.95 0.04 285)" value={funnel[funnel.length - 1]?.count || 0} label="Réponses complètes" sub="enregistrées" />
          </div>
        </>
      )}

      {tab === "responses" && (
        <ResponsesList
          survey={survey}
          responses={responses}
          onOpen={(idx) => setActiveResponseIdx(idx)}
        />
      )}

      {activeResponseIdx !== null && (
        <ResponseDrawer
          survey={survey}
          responses={responses}
          index={activeResponseIdx}
          onClose={() => setActiveResponseIdx(null)}
          onChange={(i) => setActiveResponseIdx(i)}
          onUpdate={(updated) => setResponses((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r))}
          onDelete={(deletedId) => {
            setResponses((prev) => prev.filter((r) => r.id !== deletedId));
            setActiveResponseIdx(null);
          }}
        />
      )}
    </main>
  );
}

// ─── Liste des réponses individuelles ───
function ResponsesList({
  survey,
  responses,
  onOpen,
}: {
  survey: Survey;
  responses: SurveyResponse[];
  onOpen: (i: number) => void;
}) {
  if (!responses.length) {
    return (
      <div className="civiq-card" style={{ textAlign: "center", padding: 48, borderStyle: "dashed" }}>
        <ListChecks size={40} style={{ color: "var(--fg-xmuted)", margin: "0 auto 12px" }} strokeWidth={1.5} />
        <p style={{ fontSize: 14, color: "var(--fg-muted)" }}>Aucune réponse pour le moment</p>
      </div>
    );
  }
  // Find first text-y field for preview
  const firstNamedField = survey.schema.steps
    .flatMap((s) => s.fields)
    .find((f) => f.id === "nom" || f.id === "nom_structure" || f.id === "president" || f.type === "text" || f.type === "email");

  return (
    <div className="civiq-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["#", "Soumis le", "Identifiant", "Durée", ""].map((h) => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.07em", background: "var(--bg)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {responses.map((r, i) => {
              const data = r.data as Record<string, unknown>;
              const ident =
                r.respondent_name ||
                r.respondent_email ||
                (firstNamedField && data[firstNamedField.id] ? String(data[firstNamedField.id]) : "Anonyme");
              const dur = r.duration_seconds || 0;
              return (
                <tr key={r.id} className="civiq-table-row" style={{ cursor: "pointer" }} onClick={() => onOpen(i)}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--fg-muted)", fontWeight: 600 }}>#{i + 1}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--fg)" }}>
                    {new Date(r.submitted_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--fg)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ident}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--fg-muted)" }}>
                    {dur ? `${Math.floor(dur / 60)}m${(dur % 60).toString().padStart(2, "0")}` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <span className="civiq-icon-btn" aria-label="Voir"><ChevronRight size={14} /></span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Drawer de détail d'une réponse ───
function ResponseDrawer({
  survey,
  responses,
  index,
  onClose,
  onChange,
  onUpdate,
  onDelete,
}: {
  survey: Survey;
  responses: SurveyResponse[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
  onUpdate: (updated: SurveyResponse) => void;
  onDelete: (id: string) => void;
}) {
  const r = responses[index];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...((r?.data as Record<string, unknown>) || {}) }));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset draft quand on change de réponse
  useEffect(() => {
    if (r) {
      setDraft({ ...((r.data as Record<string, unknown>) || {}) });
      setEditing(false);
    }
  }, [r?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return null;
  const data = editing ? draft : ((r.data as Record<string, unknown>) || {});

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/responses/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: draft }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Erreur lors de la sauvegarde");
      return;
    }
    onUpdate({ ...r, data: draft });
    setEditing(false);
  }

  async function remove() {
    if (!confirm("Supprimer définitivement cette réponse ? Cette action est irréversible.")) return;
    setDeleting(true);
    const res = await fetch(`/api/responses/${r.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Erreur lors de la suppression");
      return;
    }
    onDelete(r.id);
  }

  function setFieldValue(fieldId: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [fieldId]: value }));
  }

  function renderValue(field: SurveyField, value: unknown): React.ReactNode {
    if (value === undefined || value === null || value === "") return <span style={{ color: "var(--fg-xmuted)", fontStyle: "italic" }}>(non renseigné)</span>;
    const opts = field.options;
    if (Array.isArray(value)) {
      const labels = value.map((v) => opts?.find((o) => o.value === v)?.label || String(v));
      return <span>{labels.join(", ")}</span>;
    }
    const lbl = opts?.find((o) => o.value === String(value))?.label;
    return <span>{lbl || String(value)}</span>;
  }

  function renderEditor(field: SurveyField, value: unknown): React.ReactNode {
    const v = value;
    switch (field.type) {
      case "text":
      case "email":
      case "tel":
        return <input type={field.type} className="civiq-input" value={(v as string) || ""} onChange={(e) => setFieldValue(field.id, e.target.value)} />;
      case "textarea":
        return <textarea className="civiq-input civiq-textarea" rows={3} value={(v as string) || ""} onChange={(e) => setFieldValue(field.id, e.target.value)} />;
      case "number":
        return <input type="number" className="civiq-input" value={(v as number | string) ?? ""} onChange={(e) => setFieldValue(field.id, e.target.value === "" ? "" : Number(e.target.value))} />;
      case "date":
        return <input type="date" className="civiq-input" value={(v as string) || ""} onChange={(e) => setFieldValue(field.id, e.target.value)} />;
      case "select":
      case "radio":
        return (
          <select className="civiq-select" value={(v as string) || ""} onChange={(e) => setFieldValue(field.id, e.target.value)}>
            <option value="">— Sélectionner —</option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      case "checkbox":
      case "checkbox_grid": {
        const arr = Array.isArray(v) ? (v as string[]) : [];
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {field.options?.map((o) => {
              const checked = arr.includes(o.value);
              return (
                <label key={o.value} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`, background: checked ? "var(--accent-light)" : "var(--card)", fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={checked} onChange={() => {
                    const next = checked ? arr.filter((x) => x !== o.value) : [...arr, o.value];
                    setFieldValue(field.id, next);
                  }} />
                  {o.label}
                </label>
              );
            })}
          </div>
        );
      }
      case "scale": {
        const min = field.min ?? 1;
        const max = field.max ?? 5;
        return (
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => {
              const sel = Number(v) === n;
              return (
                <button key={n} type="button" onClick={() => setFieldValue(field.id, n)} style={{
                  width: 36, height: 36, borderRadius: 99, border: `1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                  background: sel ? "var(--accent)" : "var(--card)", color: sel ? "#fff" : "var(--fg)",
                  fontWeight: 600, cursor: "pointer",
                }}>{n}</button>
              );
            })}
          </div>
        );
      }
      default:
        return null;
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.5)",
        zIndex: 999, display: "flex", justifyContent: "flex-end", backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)", height: "100%", background: "var(--card)",
          display: "flex", flexDirection: "column", boxShadow: "-12px 0 40px oklch(0 0 0 / 0.15)",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Réponse #{index + 1} sur {responses.length}</div>
            <div style={{ fontSize: 13, color: "var(--fg)", fontWeight: 600 }}>
              {new Date(r.submitted_at).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {!editing ? (
              <>
                <button type="button" onClick={() => setEditing(true)} className="civiq-icon-btn" title="Modifier">
                  <Pencil size={16} />
                </button>
                <button type="button" onClick={remove} disabled={deleting} className="civiq-icon-btn danger" title="Supprimer">
                  <Trash2 size={16} />
                </button>
                <button type="button" disabled={index === 0} onClick={() => onChange(index - 1)} className="civiq-icon-btn" title="Précédente">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" disabled={index === responses.length - 1} onClick={() => onChange(index + 1)} className="civiq-icon-btn" title="Suivante">
                  <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setEditing(false); setDraft({ ...((r.data as Record<string, unknown>) || {}) }); }} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
                  Annuler
                </button>
                <button type="button" onClick={save} disabled={saving} className="civiq-btn civiq-btn-default civiq-btn-sm">
                  <Save size={13} /> {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </>
            )}
            <button type="button" onClick={onClose} className="civiq-icon-btn" title="Fermer">
              <X size={16} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 32px" }}>
          {(r.respondent_name || r.respondent_email || r.respondent_phone) && (
            <div className="civiq-card" style={{ marginBottom: 16, padding: 14 }}>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Identité</div>
              <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                {r.respondent_name && <div><strong>Nom :</strong> {r.respondent_name}</div>}
                {r.respondent_email && <div><strong>Email :</strong> {r.respondent_email}</div>}
                {r.respondent_phone && <div><strong>Téléphone :</strong> {r.respondent_phone}</div>}
                {r.duration_seconds ? <div><strong>Durée :</strong> {Math.floor(r.duration_seconds / 60)}m{(r.duration_seconds % 60).toString().padStart(2, "0")}</div> : null}
              </div>
            </div>
          )}
          {survey.schema.steps.map((step) => (
            <div key={step.id} style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                {step.title}
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                {step.fields.map((field) => (
                  <div key={field.id}>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 6, fontWeight: 500 }}>{field.label}</div>
                    {editing
                      ? renderEditor(field, data[field.id])
                      : <div style={{ fontSize: 14, color: "var(--fg)", lineHeight: 1.5 }}>{renderValue(field, data[field.id])}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetaCard({ icon, iconBg, value, label, sub }: { icon: React.ReactNode; iconBg: string; value: string | number; label: string; sub?: string }) {
  return (
    <div className="civiq-card civiq-stat-card">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--accent)" }}>
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--fg)", lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 5, fontWeight: 500 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--fg-xmuted)", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function SparkLine({ points }: { points: TimelinePoint[] }) {
  const W = 800;
  const H = 120;
  const PAD_X = 20;
  const PAD_Y = 12;
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = (W - PAD_X * 2) / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = PAD_X + i * step;
    const y = H - PAD_Y - (p.count / max) * (H - PAD_Y * 2);
    return { x, y, ...p };
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]?.x || 0},${H - PAD_Y} L${coords[0]?.x || 0},${H - PAD_Y} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkFill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c) => (
          <circle key={c.date} cx={c.x} cy={c.y} r="3" fill="var(--card)" stroke="var(--accent)" strokeWidth="2" />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 12px" }}>
        {points.map((p) => (
          <div key={p.date} style={{ textAlign: "center", fontSize: 11, color: "var(--fg-muted)" }}>
            <div style={{ fontWeight: 600, color: "var(--fg)" }}>{p.count}</div>
            <div style={{ textTransform: "capitalize" }}>{p.day}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ q }: { q: QuestionAnalytics }) {
  const typeLabels: Record<string, string> = {
    radio: "Choix unique",
    select: "Liste",
    checkbox: "Choix multiple",
    checkbox_grid: "Grille",
    scale: "Échelle",
  };
  return (
    <div className="civiq-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>{q.field.label}</h3>
          <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {q.totalAnswers} réponse{q.totalAnswers > 1 ? "s" : ""}
          </p>
        </div>
        <span className="civiq-badge civiq-badge-muted">{typeLabels[q.field.type] || q.field.type}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.distribution.map((d) => (
          <div key={d.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
              <span style={{ color: "var(--fg)" }}>{d.label}</span>
              <span style={{ color: "var(--fg-muted)", fontWeight: 600 }}>
                {d.value} <span style={{ color: "var(--fg-xmuted)", fontWeight: 500 }}>({d.pct}%)</span>
              </span>
            </div>
            <div style={{ height: 8, background: "var(--border-light)", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  width: `${d.pct}%`,
                  height: "100%",
                  background: "var(--accent)",
                  borderRadius: 99,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Funnel({ steps }: { steps: FunnelStep[] }) {
  if (!steps.length) {
    return <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Le sondage n'a pas encore de structure.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {steps.map((s, i) => {
        const highDrop = s.drop > 15 && i > 0;
        return (
          <div key={s.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-xmuted)", background: "var(--border-light)", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{s.title}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
                <strong style={{ color: "var(--fg)" }}>{s.count}</strong>
                <span style={{ margin: "0 6px" }}>·</span>
                {s.pct}%
              </div>
            </div>
            <div
              style={{
                position: "relative",
                height: 36,
                background: "var(--border-light)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(s.pct, 2)}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%)`,
                  transition: "width 0.6s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: s.pct > 10 ? 12 : 0,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {s.pct > 10 && `${s.pct}%`}
              </div>
            </div>
            {i > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: highDrop ? "var(--destructive)" : "var(--fg-muted)",
                  }}
                >
                  {s.drop > 0 ? `−${s.drop}% d'abandon` : "Stable"}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m${s.toString().padStart(2, "0")}`;
}
