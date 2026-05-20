"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  FileText,
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

export default function SurveysSection() {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalSurveys: 0, activeSurveys: 0, totalResponses: 0 });
  const [loading, setLoading] = useState(true);
  const [commune, setCommune] = useState<{ name: string; slug: string } | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const canCreate = role === "admin" || role === "super_admin";
  const canDelete = role === "admin" || role === "super_admin";

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [surveysRes, profileRes] = await Promise.all([
        fetch("/api/surveys"),
        fetch("/api/auth/me"),
      ]);

      let surveyData: SurveyRow[] = [];
      if (surveysRes.ok) {
        surveyData = await surveysRes.json() as SurveyRow[];
        setSurveys(surveyData);
      }

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.commune) setCommune(profileData.commune);
        if (profileData.role) setRole(profileData.role);
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
    <section style={{ marginBottom: 24 }}>
      {/* En-tête de section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", letterSpacing: "-0.01em" }}>Mes sondages</h2>
          {role === "viewer" && (
            <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>
              Accès en lecture seule.
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canDelete && (
            <Link href="/admin/surveys/trash" className="civiq-btn civiq-btn-outline civiq-btn-sm" title="Corbeille">
              <Trash2 size={13} /> Corbeille
            </Link>
          )}
          {canCreate && (
            <Link href="/admin/surveys/new" className="civiq-btn civiq-btn-default civiq-btn-sm">
              <Plus size={13} /> Nouveau sondage
            </Link>
          )}
        </div>
      </div>

      {/* Surveys table */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {stats.totalSurveys} sondage{stats.totalSurveys > 1 ? "s" : ""} · {stats.activeSurveys} actif{stats.activeSurveys > 1 ? "s" : ""} · {stats.totalResponses} réponse{stats.totalResponses > 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 12, color: "var(--fg-muted)", background: "var(--border-light)", padding: "3px 10px", borderRadius: 99, fontWeight: 500 }}>
            {surveys.length} sondage{surveys.length > 1 ? "s" : ""}
          </span>
        </div>

        {surveys.length === 0 ? (
          <div className="civiq-card" style={{ textAlign: "center", padding: "56px 24px", borderStyle: "dashed" }}>
            <FileText size={40} style={{ color: "var(--fg-xmuted)", margin: "0 auto 16px" }} strokeWidth={1.5} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", marginBottom: 8 }}>Aucun sondage pour le moment</h3>
            <p style={{ fontSize: 14, color: "var(--fg-muted)", marginBottom: 20 }}>
              {canCreate ? "Créez votre premier sondage ou partez d'un modèle." : "Aucun sondage publié dans cette commune."}
            </p>
            {canCreate && <Link href="/admin/surveys/new" className="civiq-btn civiq-btn-default">
              <Plus size={14} /> Créer un sondage
            </Link>}
          </div>
        ) : (
          <div className="civiq-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="civiq-table-mobile-cards" style={{ width: "100%", borderCollapse: "collapse" }}>
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
                        <td data-label="Statut" style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          {getStatusBadge(s.status)}
                        </td>
                        <td data-label="Réponses" style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                          {(s.responses?.[0] as { count: number } | undefined)?.count || 0}
                        </td>
                        <td data-label="Créé le" style={{ padding: "14px 16px", fontSize: 13, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                          {new Date(s.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="civiq-table-actions" style={{ padding: "14px 16px" }}>
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
                            {canDelete && <button
                              type="button"
                              onClick={() => deleteSurvey(s.id, s.title)}
                              className="civiq-icon-btn danger"
                              title="Mettre à la corbeille"
                            >
                              <Trash2 size={14} />
                            </button>}
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
    </section>
  );
}
