"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  FileText,
  Boxes,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Activity,
  CheckCircle2,
} from "lucide-react";

interface CommuneStats {
  id: string;
  name: string;
  slug: string;
  user_count: number;
  survey_count: number;
  response_count: number;
  module_count: number;
  created_at: string;
  archived_at?: string | null;
}

interface AnalyticsPayload {
  activity_by_hour: { hour: number; count: number }[];
  activity_grid: number[][];          // [dayOfWeek 0=lundi][hour 0..23]
  total_responses_30d: number;
  peak_hour: number;
  peak_hour_count: number;
  active_days: number;
}

const DOW_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export default function SuperAdminDashboard() {
  const [communes, setCommunes] = useState<CommuneStats[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/super-admin/communes").then((r) => r.ok ? r.json() : []),
      fetch("/api/super-admin/analytics").then((r) => r.ok ? r.json() : null),
    ])
      .then(([cs, an]) => {
        if (Array.isArray(cs)) setCommunes(cs);
        if (an && !an.error) setAnalytics(an);
      })
      .finally(() => setLoading(false));
  }, []);

  // Communes non archivées (les autres KPI / cartes les ignorent)
  const liveCommunes = useMemo(
    () => communes.filter((c) => !c.archived_at),
    [communes]
  );

  const totals = useMemo(
    () =>
      liveCommunes.reduce(
        (acc, c) => ({
          users: acc.users + (c.user_count || 0),
          surveys: acc.surveys + (c.survey_count || 0),
          responses: acc.responses + (c.response_count || 0),
          modules: acc.modules + (c.module_count || 0),
        }),
        { users: 0, surveys: 0, responses: 0, modules: 0 }
      ),
    [liveCommunes]
  );

  // Une commune est "active" si elle a au moins 1 sondage publié OU ≥ 1 réponse
  const activeCommunes = useMemo(
    () => liveCommunes.filter((c) => (c.survey_count || 0) > 0 || (c.response_count || 0) > 0).length,
    [liveCommunes]
  );

  const archivedCount = communes.length - liveCommunes.length;

  // Max heatmap pour l'échelle
  const heatMax = useMemo(() => {
    if (!analytics?.activity_grid) return 0;
    let m = 0;
    for (const row of analytics.activity_grid) for (const v of row) if (v > m) m = v;
    return m;
  }, [analytics]);

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <div>
          <h1 className="civiq-h1">Vue d&apos;ensemble</h1>
          <p className="civiq-muted">Pilotage de toutes les communes de la plateforme.</p>
        </div>
      </header>

      {/* KPIs */}
      <div className="sa-stats">
        <StatCard icon={<Building2 size={18} />} value={liveCommunes.length} label="Communes inscrites" sub={archivedCount ? `${archivedCount} archivée${archivedCount > 1 ? "s" : ""}` : `${activeCommunes} actives`} bg="oklch(0.95 0.04 258)" />
        <StatCard icon={<CheckCircle2 size={18} />} value={activeCommunes} label="Communes actives" sub={liveCommunes.length ? `${Math.round((activeCommunes / liveCommunes.length) * 100)}% engagement` : "—"} bg="oklch(0.95 0.06 155)" />
        <StatCard icon={<Users size={18} />} value={totals.users} label="Utilisateurs" sub={`${(totals.users / Math.max(1, liveCommunes.length)).toFixed(1)} en moyenne / commune`} bg="oklch(0.95 0.05 30)" />
        <StatCard icon={<FileText size={18} />} value={totals.surveys} label="Sondages créés" sub={`${totals.responses} réponses`} bg="oklch(0.95 0.04 285)" />
      </div>

      {/* Activity row */}
      <div className="sa-activity-row">
        <StatCard
          icon={<Activity size={18} />}
          value={analytics?.total_responses_30d ?? 0}
          label="Réponses (30j)"
          sub="Toutes communes"
          bg="oklch(0.95 0.04 258)"
        />
        <StatCard
          icon={<Clock size={18} />}
          value={analytics ? `${String(analytics.peak_hour).padStart(2, "0")}h` : "—"}
          label="Heure de pointe"
          sub={analytics?.peak_hour_count ? `${analytics.peak_hour_count} réponses à cette heure` : "—"}
          bg="oklch(0.95 0.05 30)"
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          value={analytics?.active_days ?? 0}
          label="Jours actifs"
          sub="(sur 30)"
          bg="oklch(0.95 0.06 155)"
        />
        <StatCard icon={<Boxes size={18} />} value={totals.modules} label="Modules activés" sub="Cumul plateforme" bg="oklch(0.95 0.04 285)" />
      </div>

      {/* Heatmap */}
      <section className="sa-section">
        <div className="sa-section-header">
          <div>
            <h2 className="civiq-h2">Activité hebdomadaire</h2>
            <p className="civiq-muted" style={{ fontSize: 13, marginTop: 2 }}>
              Heures où vos administrés sont les plus actifs (30 derniers jours)
            </p>
          </div>
          {heatMax > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--fg-muted)" }}>
              <span>0</span>
              <div style={{ display: "flex", gap: 2 }}>
                {[0.15, 0.35, 0.6, 0.85, 1].map((p, i) => (
                  <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: heatColor(p) }} />
                ))}
              </div>
              <span>{heatMax}+</span>
            </div>
          )}
        </div>

        <div className="civiq-card sa-heatmap-card">
          {!analytics ? (
            <div className="sa-empty" style={{ border: "none" }}>Chargement…</div>
          ) : heatMax === 0 ? (
            <div className="sa-empty" style={{ border: "none" }}>Pas encore de réponses sur 30 jours.</div>
          ) : (
            <div className="sa-heatmap">
              <div className="sa-heatmap-hours">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="sa-heatmap-hour-label">{h % 3 === 0 ? `${h}h` : ""}</div>
                ))}
              </div>
              {DOW_LABELS.map((d, dow) => (
                <div key={dow} className="sa-heatmap-row">
                  <div className="sa-heatmap-day-label">{d}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const v = analytics.activity_grid[dow]?.[h] || 0;
                    const intensity = heatMax ? v / heatMax : 0;
                    return (
                      <div
                        key={h}
                        className="sa-heatmap-cell"
                        title={`${d} ${h}h — ${v} réponse${v > 1 ? "s" : ""}`}
                        style={{ background: v ? heatColor(intensity) : "var(--border-light)" }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Communes recentes */}
      <section className="sa-section">
        <div className="sa-section-header">
          <h2 className="civiq-h2">Communes récentes</h2>
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
            {liveCommunes.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/super-admin/communes/${c.id}`} className="civiq-card civiq-card-hover sa-commune-card">
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
        .sa-page { max-width: 1200px; margin: 0 auto; padding: 32px 28px 60px; }
        .sa-page-header { margin-bottom: 28px; }
        .sa-page-header p { margin-top: 4px; font-size: 14px; }

        .sa-stats, .sa-activity-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }
        .sa-activity-row { margin-bottom: 32px; }

        .sa-section { margin-top: 12px; margin-bottom: 28px; }
        .sa-section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 14px;
          gap: 12px;
        }
        .sa-section-link {
          font-size: 13px;
          font-weight: 600;
          color: var(--accent);
          text-decoration: none;
        }
        .sa-section-link:hover { text-decoration: underline; }

        .sa-empty {
          background: var(--bg);
          border: 1px dashed var(--border);
          border-radius: var(--radius);
          padding: 36px;
          text-align: center;
          color: var(--fg-muted);
          font-size: 14px;
        }

        .sa-heatmap-card { padding: 18px 20px; }
        .sa-heatmap { display: flex; flex-direction: column; gap: 4px; }
        .sa-heatmap-hours, .sa-heatmap-row {
          display: grid;
          grid-template-columns: 28px repeat(24, 1fr);
          gap: 3px;
          align-items: center;
        }
        .sa-heatmap-hour-label {
          font-size: 10px;
          color: var(--fg-xmuted);
          text-align: center;
          font-weight: 600;
        }
        .sa-heatmap-day-label {
          font-size: 11px;
          color: var(--fg-muted);
          font-weight: 600;
          text-align: center;
        }
        .sa-heatmap-cell {
          aspect-ratio: 1;
          border-radius: 3px;
          transition: transform 0.12s;
        }
        .sa-heatmap-cell:hover { transform: scale(1.25); cursor: default; }

        .sa-commune-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 14px;
        }
        .sa-commune-card {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-decoration: none;
        }
        .sa-commune-card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .sa-commune-avatar {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: var(--accent);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700;
          font-size: 16px;
        }
        .sa-commune-arrow { color: var(--fg-xmuted); }
        .sa-commune-card strong {
          font-size: 15px;
          font-weight: 600;
          color: var(--fg);
        }
        .sa-slug { font-size: 12px; font-family: ui-monospace, monospace; }
        .sa-commune-stats {
          display: flex;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
          font-size: 11px;
          color: var(--fg-muted);
        }
        .sa-commune-stats b { color: var(--fg); font-weight: 700; font-size: 13px; }
      `}</style>
    </div>
  );
}

function StatCard({ icon, value, label, sub, bg }: {
  icon: React.ReactNode; value: number | string; label: string; sub?: string; bg: string;
}) {
  return (
    <div className="civiq-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: bg, color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", lineHeight: 1.1, letterSpacing: "-0.03em" }}>{value}</div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 3, fontWeight: 500 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--fg-xmuted)", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function heatColor(intensity: number): string {
  // 0..1 → from very-light to deep accent
  const t = Math.max(0, Math.min(1, intensity));
  // oklch ramp around the accent (blue)
  const l = 0.95 - 0.4 * t;   // 0.95 → 0.55
  const c = 0.04 + 0.16 * t;  // 0.04 → 0.20
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} 258)`;
}
