"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Building2, Users, FileText, Boxes, ArrowUpRight } from "lucide-react";

interface CommuneStats {
  id: string;
  name: string;
  slug: string;
  user_count: number;
  survey_count: number;
  response_count: number;
  module_count: number;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const [communes, setCommunes] = useState<CommuneStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/super-admin/communes")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setCommunes(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const totals = communes.reduce(
    (acc, c) => ({
      users: acc.users + (c.user_count || 0),
      surveys: acc.surveys + (c.survey_count || 0),
      responses: acc.responses + (c.response_count || 0),
    }),
    { users: 0, surveys: 0, responses: 0 }
  );

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <div>
          <h1 className="civiq-h1">Vue d'ensemble</h1>
          <p className="civiq-muted">Pilotage de toutes les communes de la plateforme.</p>
        </div>
      </header>

      {/* Stats globales */}
      <div className="sa-stats">
        <StatCard icon={<Building2 size={20} />} value={communes.length} label="Communes actives" color="#fff8f6" textColor="#c13515" />
        <StatCard icon={<Users size={20} />} value={totals.users} label="Utilisateurs" color="#f0f7ff" textColor="#006da3" />
        <StatCard icon={<FileText size={20} />} value={totals.surveys} label="Sondages créés" color="#f0faef" textColor="#008a05" />
        <StatCard icon={<Boxes size={20} />} value={totals.responses} label="Réponses citoyennes" color="#fff8e1" textColor="#b45309" />
      </div>

      {/* Liste communes */}
      <section className="sa-section">
        <div className="sa-section-header">
          <h2 className="civiq-h2">Communes</h2>
          <Link href="/super-admin/communes" className="sa-section-link">
            Voir toutes →
          </Link>
        </div>

        {loading ? (
          <div className="sa-empty">Chargement…</div>
        ) : communes.length === 0 ? (
          <div className="sa-empty">Aucune commune pour le moment.</div>
        ) : (
          <div className="sa-commune-grid">
            {communes.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/super-admin/communes`} className="civiq-card civiq-card-hover sa-commune-card">
                <div className="sa-commune-card-head">
                  <div className="sa-commune-avatar">{c.name.charAt(0)}</div>
                  <ArrowUpRight size={16} className="sa-commune-arrow" />
                </div>
                <strong>{c.name}</strong>
                <span className="civiq-muted sa-slug">/{c.slug}</span>
                <div className="sa-commune-stats">
                  <div><b>{c.user_count}</b> users</div>
                  <div><b>{c.survey_count}</b> sondages</div>
                  <div><b>{c.module_count}</b> modules</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .sa-page { max-width: 1200px; margin: 0 auto; padding: 40px 32px 60px; }
        .sa-page-header { margin-bottom: 32px; }
        .sa-page-header p { margin-top: 6px; font-size: 16px; }

        .sa-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 40px;
        }

        .sa-section { margin-top: 8px; }
        .sa-section-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 20px;
        }
        .sa-section-link {
          font-size: 14px;
          font-weight: 600;
          color: var(--civiq-text);
          text-decoration: none;
        }
        .sa-section-link:hover { text-decoration: underline; }

        .sa-empty {
          background: var(--civiq-surface);
          border: 1px dashed var(--civiq-border-strong);
          border-radius: var(--civiq-radius);
          padding: 48px;
          text-align: center;
          color: var(--civiq-text-soft);
        }

        .sa-commune-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }
        .sa-commune-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sa-commune-card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .sa-commune-avatar {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #ff5a5f, #c93a3f);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          font-size: 18px;
        }
        .sa-commune-arrow { color: var(--civiq-text-light); }
        .sa-commune-card strong {
          font-size: 16px;
          font-weight: 600;
          color: var(--civiq-text);
        }
        .sa-slug { font-size: 13px; font-family: monospace; }
        .sa-commune-stats {
          display: flex;
          gap: 16px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--civiq-border);
          font-size: 12px;
          color: var(--civiq-text-soft);
        }
        .sa-commune-stats b { color: var(--civiq-text); font-weight: 700; font-size: 14px; }
      `}</style>
    </div>
  );
}

function StatCard({ icon, value, label, color, textColor }: {
  icon: React.ReactNode; value: number; label: string; color: string; textColor: string;
}) {
  return (
    <div className="civiq-card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: color, color: textColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "var(--civiq-text)", lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 13, color: "var(--civiq-text-soft)" }}>{label}</div>
      </div>
    </div>
  );
}
