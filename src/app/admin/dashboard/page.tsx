"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  FileText,
  Users,
  TrendingUp,
  Download,
  Plus,
  Eye,
  ExternalLink,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import QrShare from "@/components/survey/QrShare";

interface SurveyRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
  published_at: string | null;
  ends_at: string | null;
  responses: { count: number }[];
}

interface DashboardStats {
  totalSurveys: number;
  activeSurveys: number;
  totalResponses: number;
}

export default function AdminDashboard() {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalSurveys: 0, activeSurveys: 0, totalResponses: 0 });
  const [loading, setLoading] = useState(true);
  const [commune, setCommune] = useState<{ name: string; slug: string } | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [surveysRes, profileRes] = await Promise.all([
        fetch("/api/surveys"),
        fetch("/api/auth/me"),
      ]);

      if (surveysRes.status === 403) return;
      if (!surveysRes.ok) return;

      const surveyData = await surveysRes.json() as SurveyRow[];
      setSurveys(surveyData);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.commune) setCommune(profileData.commune);
      }

      setStats({
        totalSurveys: surveyData.length,
        activeSurveys: surveyData.filter((s) => s.status === "published").length,
        totalResponses: surveyData.reduce(
          (sum, s) => sum + ((s.responses?.[0] as { count: number } | undefined)?.count || 0),
          0
        ),
      });
    } catch (err) {
      console.error("loadData error:", err);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const map: Record<string, { cls: string; label: string }> = {
      draft:     { cls: "civiq-badge civiq-badge-muted",       label: "Brouillon" },
      published: { cls: "civiq-badge civiq-badge-success",     label: "Publié" },
      closed:    { cls: "civiq-badge civiq-badge-warning",     label: "Terminé" },
      archived:  { cls: "civiq-badge civiq-badge-destructive", label: "Archivé" },
    };
    const s = map[status] || map.draft;
    return <span className={s.cls}>{s.label}</span>;
  }

  async function copyLink(slug: string) {
    const url = `${window.location.origin}/survey/${slug}${commune ? `?commune=${commune.slug}` : ""}`;
    await navigator.clipboard.writeText(url);
  }

  async function deleteSurvey(id: string, title: string) {
    const ok = window.confirm(
      `Supprimer définitivement le sondage « ${title} » ?\n\nCette action est irréversible.`
    );
    if (!ok) return;
    const res = await fetch(`/api/surveys/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Erreur inconnue" }));
      alert(`Suppression impossible : ${body.error || res.statusText}`);
      return;
    }
    setSurveys((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16, color: "var(--fg-muted)" }}>
        <div className="civiq-spin" style={{ width: 28, height: 28, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
        <p style={{ fontSize: 14 }}>Chargement…</p>
      </div>
    );
  }

  return (
    <main className="civiq-main">
      {/* Page header */}
      <div className="civiq-page-header">
        <div>
          <h1 className="civiq-page-title">Tableau de bord</h1>
          {commune && <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 3 }}>{commune.name}</p>}
        </div>
        <Link href="/admin/surveys/new" className="civiq-btn civiq-btn-default">
          <Plus size={15} />
          Nouveau sondage
        </Link>
      </div>

      {/* KPI cards */}
      <div className="civiq-stats-grid" style={{ marginBottom: 32 }}>
        {[
          { icon: FileText, value: stats.totalSurveys, label: "Sondages créés", color: "oklch(0.95 0.04 258)" },
          { icon: TrendingUp, value: stats.activeSurveys, label: "Sondages actifs", color: "oklch(0.95 0.06 155)" },
          { icon: Users, value: stats.totalResponses, label: "Réponses totales", color: "oklch(0.95 0.05 30)" },
          { icon: BarChart3, value: "—", label: "Taux complétion moy.", color: "oklch(0.95 0.04 285)" },
        ].map(({ icon: Icon, value, label, color }) => (
          <div key={label} className="civiq-card civiq-stat-card">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={18} style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--fg)", lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 5, fontWeight: 500 }}>
                  {label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Surveys table */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", letterSpacing: "-0.02em" }}>
            Vos sondages
          </h2>
          <span style={{ fontSize: 12, color: "var(--fg-muted)", background: "var(--border-light)", padding: "3px 10px", borderRadius: 99, fontWeight: 500 }}>
            {surveys.length} sondage{surveys.length > 1 ? "s" : ""}
          </span>
        </div>

        {surveys.length === 0 ? (
          <div className="civiq-card" style={{ textAlign: "center", padding: "56px 24px", borderStyle: "dashed" }}>
            <FileText size={40} style={{ color: "var(--fg-xmuted)", margin: "0 auto 16px" }} strokeWidth={1.5} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", marginBottom: 8 }}>Aucun sondage pour le moment</h3>
            <p style={{ fontSize: 14, color: "var(--fg-muted)", marginBottom: 20 }}>Créez votre premier sondage ou partez d'un modèle.</p>
            <Link href="/admin/surveys/new" className="civiq-btn civiq-btn-default">
              <Plus size={14} /> Créer un sondage
            </Link>
          </div>
        ) : (
          <div className="civiq-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Sondage", "Statut", "Réponses", "Créé le", "Actions"].map((h) => (
                      <th key={h} style={{
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--fg-muted)",
                        textAlign: "left",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        background: "var(--bg)",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {surveys.map((s) => {
                    const publicUrl = `/survey/${s.slug}${commune ? `?commune=${commune.slug}` : ""}`;
                    return (
                      <tr key={s.id} className="civiq-table-row">
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--fg)", marginBottom: 4 }}>
                            {s.title}
                          </div>
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <ExternalLink size={11} />
                            /survey/{s.slug}
                          </a>
                        </td>
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          {getStatusBadge(s.status)}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                          {(s.responses?.[0] as { count: number } | undefined)?.count || 0}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                          {new Date(s.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", gap: 2 }}>
                            <Link href={`/admin/surveys/${s.id}/edit`} className="civiq-icon-btn" title="Modifier">
                              <Pencil size={14} />
                            </Link>
                            <Link href={`/admin/surveys/${s.id}`} className="civiq-icon-btn" title="Statistiques">
                              <BarChart3 size={14} />
                            </Link>
                            <a href={publicUrl} target="_blank" rel="noreferrer" className="civiq-icon-btn" title="Aperçu">
                              <Eye size={14} />
                            </a>
                            <button onClick={() => copyLink(s.slug)} className="civiq-icon-btn" title="Copier le lien" type="button">
                              <Copy size={14} />
                            </button>
                            <QrShare
                              url={typeof window !== "undefined" ? `${window.location.origin}${publicUrl}` : publicUrl}
                              title={s.title}
                            />
                            <a href={`/api/export?survey_id=${s.id}&format=xlsx`} className="civiq-icon-btn" title="Exporter Excel">
                              <Download size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={() => deleteSurvey(s.id, s.title)}
                              className="civiq-icon-btn danger"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
