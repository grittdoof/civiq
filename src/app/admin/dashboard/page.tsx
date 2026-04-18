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
} from "lucide-react";
import Link from "next/link";

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

// Type pour le profil retourné par Supabase avec la relation communes
interface ProfileWithCommune {
  commune_id: string | null;
  communes: { name: string; slug: string } | null;
}

interface DashboardStats {
  totalSurveys: number;
  activeSurveys: number;
  totalResponses: number;
  avgCompletionRate: number;
}

export default function AdminDashboard() {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalSurveys: 0,
    activeSurveys: 0,
    totalResponses: 0,
    avgCompletionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [commune, setCommune] = useState<{ name: string; slug: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Tout passe par les API routes (service client côté serveur, bypass RLS)
      const [surveysRes] = await Promise.all([
        fetch("/api/surveys"),
      ]);

      if (surveysRes.status === 403) {
        // Pas de commune configurée encore
        return;
      }

      if (!surveysRes.ok) {
        console.error("Surveys API error:", surveysRes.status);
        return;
      }

      const surveyData = await surveysRes.json() as SurveyRow[];
      setSurveys(surveyData);

      // Charger la commune via l'API profil
      const profileRes = await fetch("/api/auth/me");
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.commune) setCommune(profileData.commune);
      }

      const total = surveyData.length;
      const active = surveyData.filter((s) => s.status === "published").length;
      const responses = surveyData.reduce(
        (sum: number, s) => sum + ((s.responses as { count: number }[])?.[0]?.count || 0),
        0
      );

      setStats({
        totalSurveys: total,
        activeSurveys: active,
        totalResponses: responses,
        avgCompletionRate: 0,
      });
    } catch (err) {
      console.error("loadData error:", err);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      draft: { bg: "#f5f5f5", color: "#888", label: "Brouillon" },
      published: { bg: "#e8f5e9", color: "#2e7d32", label: "Publié" },
      closed: { bg: "#fff3e0", color: "#e65100", label: "Terminé" },
      archived: { bg: "#fce4ec", color: "#c62828", label: "Archivé" },
    };
    const s = map[status] || map.draft;
    return (
      <span
        style={{
          background: s.bg,
          color: s.color,
          padding: "3px 10px",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        {s.label}
      </span>
    );
  }

  async function copyLink(slug: string) {
    const url = `${window.location.origin}/survey/${slug}${commune ? `?commune=${commune.slug}` : ""}`;
    await navigator.clipboard.writeText(url);
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <p>Chargement du tableau de bord…</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="admin-header">
        <div>
          <h1>Tableau de bord</h1>
          {commune && <p className="admin-commune">{commune.name}</p>}
        </div>
        <Link href="/admin/surveys/new" className="admin-btn primary">
          <Plus size={18} /> Nouveau sondage
        </Link>
      </header>

      {/* Stats cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue">
            <FileText size={22} />
          </div>
          <div>
            <div className="stat-value">{stats.totalSurveys}</div>
            <div className="stat-label">Sondages créés</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green">
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="stat-value">{stats.activeSurveys}</div>
            <div className="stat-label">Sondages actifs</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon amber">
            <Users size={22} />
          </div>
          <div>
            <div className="stat-value">{stats.totalResponses}</div>
            <div className="stat-label">Réponses totales</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon purple">
            <BarChart3 size={22} />
          </div>
          <div>
            <div className="stat-value">—</div>
            <div className="stat-label">Taux complétion moy.</div>
          </div>
        </div>
      </div>

      {/* Surveys list */}
      <div className="surveys-section">
        <h2>Vos sondages</h2>
        {surveys.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} strokeWidth={1} />
            <h3>Aucun sondage pour le moment</h3>
            <p>Créez votre premier sondage ou partez d'un modèle existant.</p>
            <Link href="/admin/surveys/new" className="admin-btn primary">
              <Plus size={18} /> Créer un sondage
            </Link>
          </div>
        ) : (
          <div className="surveys-table">
            <table>
              <thead>
                <tr>
                  <th>Sondage</th>
                  <th>Statut</th>
                  <th>Réponses</th>
                  <th>Créé le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((s) => {
                  const publicUrl = `/survey/${s.slug}${commune ? `?commune=${commune.slug}` : ""}`;
                  return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title}</strong>
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="public-url"
                        title="Ouvrir le sondage public"
                      >
                        <ExternalLink size={11} />
                        /survey/{s.slug}
                      </a>
                    </td>
                    <td>{getStatusBadge(s.status)}</td>
                    <td className="responses-count">
                      {(s.responses?.[0] as { count: number } | undefined)?.count || 0}
                    </td>
                    <td className="date-cell">
                      {new Date(s.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <div className="action-btns">
                        <Link
                          href={`/admin/surveys/${s.id}/edit`}
                          className="icon-btn"
                          title="Modifier le sondage"
                        >
                          <Pencil size={16} />
                        </Link>
                        <Link
                          href={`/admin/surveys/${s.id}`}
                          className="icon-btn"
                          title="Voir les résultats"
                        >
                          <BarChart3 size={16} />
                        </Link>
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="icon-btn"
                          title={s.status === "published" ? "Ouvrir le sondage public" : "Prévisualiser (non publié)"}
                        >
                          <Eye size={16} />
                        </a>
                        <button
                          onClick={() => copyLink(s.slug)}
                          className="icon-btn"
                          title="Copier le lien public"
                        >
                          <Copy size={16} />
                        </button>
                        <a
                          href={`/api/export?survey_id=${s.id}&format=csv`}
                          className="icon-btn"
                          title="Exporter CSV"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .admin-dashboard {
          max-width: 1100px;
          margin: 0 auto;
          padding: 32px 24px;
          font-family: 'Source Sans 3', -apple-system, sans-serif;
        }

        .admin-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          color: #888;
          gap: 16px;
        }
        .spinner {
          width: 32px; height: 32px;
          border: 3px solid #e8e5de;
          border-top-color: #3b6fa0;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }
        .admin-header h1 {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 700;
          color: #1a2744;
        }
        .admin-commune { font-size: 14px; color: #888; margin-top: 4px; }

        .admin-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          border: none;
          transition: 0.2s;
        }
        .admin-btn.primary {
          background: linear-gradient(135deg, #1a2744, #3b6fa0);
          color: #fff;
          box-shadow: 0 4px 15px rgba(26,39,68,0.2);
        }
        .admin-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(26,39,68,0.3); }

        /* Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 40px;
        }
        .stat-card {
          background: #fff;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.04);
        }
        .stat-card-icon {
          width: 48px; height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .stat-card-icon.blue { background: #e6f1fb; color: #185fa5; }
        .stat-card-icon.green { background: #e8f5e9; color: #2e7d32; }
        .stat-card-icon.amber { background: #fff3e0; color: #e65100; }
        .stat-card-icon.purple { background: #eeedfe; color: #534ab7; }
        .stat-value { font-size: 26px; font-weight: 700; color: #1a2744; }
        .stat-label { font-size: 13px; color: #999; }

        /* Surveys */
        .surveys-section h2 {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 700;
          color: #1a2744;
          margin-bottom: 20px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 24px;
          background: #fff;
          border-radius: 12px;
          border: 2px dashed #e8e5de;
          color: #999;
        }
        .empty-state h3 { font-size: 18px; color: #1a2744; margin: 16px 0 8px; }
        .empty-state p { margin-bottom: 24px; }

        .surveys-table {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.04);
        }
        table { width: 100%; border-collapse: collapse; }
        thead { background: #faf7f0; }
        th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #999; border-bottom: 1px solid #e8e5de; }
        td { padding: 16px; border-bottom: 1px solid #f2efe8; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:hover { background: #faf9f6; }
        td strong { display: block; font-weight: 600; color: #1a2744; }
        .slug-label { font-size: 12px; color: #bbb; }
        .public-url {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #3b6fa0;
          text-decoration: none;
          font-family: monospace;
          margin-top: 2px;
          padding: 2px 6px;
          border-radius: 4px;
          background: #f0f7ff;
          border: 1px solid transparent;
          transition: 0.15s;
          word-break: break-all;
        }
        .public-url:hover { background: #e1efff; border-color: #b8d4f0; }
        .responses-count { font-weight: 700; color: #1a2744; font-size: 18px; }
        .date-cell { font-size: 13px; color: #999; }

        .action-btns { display: flex; gap: 8px; }
        .icon-btn {
          width: 32px; height: 32px;
          border-radius: 6px;
          border: 1px solid #e8e5de;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #888;
          text-decoration: none;
          transition: 0.2s;
        }
        .icon-btn:hover { border-color: #3b6fa0; color: #3b6fa0; background: #f0f7ff; }

        @media (max-width: 768px) {
          .admin-header { flex-direction: column; align-items: flex-start; gap: 16px; }
          .surveys-table { overflow-x: auto; }
          table { min-width: 600px; }
        }
      `}</style>
    </div>
  );
}
