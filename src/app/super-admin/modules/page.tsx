"use client";

import { useState, useEffect } from "react";
import {
  ClipboardList, PiggyBank, CalendarDays, Bell, Building2,
  Package, Sparkles, Globe,
} from "lucide-react";

interface ModuleRow {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  icon: string | null;
  category: string | null;
  is_available: boolean;
  is_beta: boolean;
  display_order: number;
  activation_count: number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "clipboard-list": <ClipboardList size={22} />,
  "piggy-bank": <PiggyBank size={22} />,
  "calendar-days": <CalendarDays size={22} />,
  "bell": <Bell size={22} />,
  "building-2": <Building2 size={22} />,
};

const CATEGORY_LABEL: Record<string, string> = {
  consultation: "Consultation",
  gestion: "Gestion",
  communication: "Communication",
};

export default function SuperAdminModules() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/modules");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setModules(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggle(id: string, field: "is_available" | "is_beta", value: boolean) {
    setSavingId(id);
    // Optimistic update
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
    const res = await fetch("/api/super-admin/modules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_id: id, [field]: value }),
    });
    if (!res.ok) {
      // Rollback
      setModules((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: !value } : m)));
      const body = await res.json().catch(() => ({ error: "Erreur" }));
      alert(`Mise à jour impossible : ${body.error}`);
    }
    setSavingId(null);
  }

  const available = modules.filter((m) => m.is_available).length;
  const totalActivations = modules.reduce((sum, m) => sum + m.activation_count, 0);

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <h1 className="civiq-h1">Modules</h1>
        <p className="civiq-muted">
          Catalogue des modules disponibles sur la plateforme. Activez/désactivez leur disponibilité
          globale ou marquez-les comme beta.
        </p>
      </header>

      {/* KPIs */}
      <div className="mod-kpis">
        <div className="mod-kpi">
          <Package size={18} />
          <strong>{modules.length}</strong>
          <span>Modules au catalogue</span>
        </div>
        <div className="mod-kpi">
          <Globe size={18} />
          <strong>{available}</strong>
          <span>Disponibles</span>
        </div>
        <div className="mod-kpi">
          <Sparkles size={18} />
          <strong>{totalActivations}</strong>
          <span>Activations totales</span>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="sa-cell-empty">Chargement…</div>
      ) : modules.length === 0 ? (
        <div className="sa-cell-empty">Aucun module au catalogue.</div>
      ) : (
        <div className="mod-grid">
          {modules.map((m) => (
            <article key={m.id} className={`mod-card ${!m.is_available ? "disabled" : ""}`}>
              <div className="mod-card-head">
                <div className="mod-icon">{ICON_MAP[m.icon || ""] || <Package size={22} />}</div>
                <div className="mod-meta">
                  {m.category && <span className="civiq-badge">{CATEGORY_LABEL[m.category] || m.category}</span>}
                  {m.is_beta && <span className="civiq-badge civiq-badge-warning">BETA</span>}
                </div>
              </div>

              <h3 className="mod-title">{m.name}</h3>
              {m.tagline && <p className="mod-tagline">{m.tagline}</p>}
              {m.description && <p className="mod-desc">{m.description}</p>}

              <div className="mod-stats">
                <span>
                  <strong>{m.activation_count}</strong>{" "}
                  commune{m.activation_count > 1 ? "s" : ""} l'utilise{m.activation_count > 1 ? "nt" : ""}
                </span>
              </div>

              <div className="mod-actions">
                <label className="mod-toggle">
                  <input
                    type="checkbox"
                    checked={m.is_available}
                    disabled={savingId === m.id}
                    onChange={(e) => toggle(m.id, "is_available", e.target.checked)}
                  />
                  <span>Disponible</span>
                </label>
                <label className="mod-toggle">
                  <input
                    type="checkbox"
                    checked={m.is_beta}
                    disabled={savingId === m.id}
                    onChange={(e) => toggle(m.id, "is_beta", e.target.checked)}
                  />
                  <span>Mode beta</span>
                </label>
              </div>
            </article>
          ))}
        </div>
      )}

      <style>{`
        .sa-page { max-width: 1200px; margin: 0 auto; padding: 40px 32px 60px; }
        .sa-page-header { margin-bottom: 24px; }
        .sa-page-header p { margin-top: 6px; max-width: 720px; }
        .sa-cell-empty { text-align: center; padding: 60px; color: var(--civiq-text-soft); }

        .mod-kpis {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 28px;
        }
        .mod-kpi {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          background: #fff;
          border: 1px solid var(--civiq-border);
          border-radius: 14px;
          min-width: 200px;
        }
        .mod-kpi strong { font-size: 22px; font-weight: 700; color: var(--civiq-text); }
        .mod-kpi span { font-size: 13px; color: var(--civiq-text-soft); margin-left: auto; }

        .mod-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 18px;
        }
        .mod-card {
          background: #fff;
          border: 1px solid var(--civiq-border);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: 0.2s;
        }
        .mod-card:hover { box-shadow: var(--civiq-shadow-card-hover); transform: translateY(-2px); }
        .mod-card.disabled { opacity: 0.55; }
        .mod-card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .mod-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #ff5a5f, #e0454a);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
        }
        .mod-meta { display: flex; gap: 6px; }
        .mod-title { font-size: 18px; font-weight: 700; color: var(--civiq-text); }
        .mod-tagline { font-size: 14px; color: var(--civiq-text-soft); font-style: italic; }
        .mod-desc { font-size: 13px; color: var(--civiq-text-soft); line-height: 1.5; }
        .mod-stats {
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px solid var(--civiq-border);
          font-size: 13px;
          color: var(--civiq-text-soft);
        }
        .mod-stats strong { color: var(--civiq-text); }
        .mod-actions {
          display: flex;
          gap: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--civiq-border);
        }
        .mod-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--civiq-text);
          cursor: pointer;
          user-select: none;
        }
        .mod-toggle input { cursor: pointer; }
        .mod-toggle input:disabled + span { color: var(--civiq-text-light); }
      `}</style>
    </div>
  );
}
