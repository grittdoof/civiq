"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ChartPie, Coins } from "lucide-react";
import DonutChart, { type DonutSlice } from "./DonutChart";
import { formatEuros } from "@/lib/projects/cost-calc";
import type { ProjectListItem } from "@/lib/projects/queries";

// ═══════════════════════════════════════════════════════════════
// ProjectsStatsDrawer — panneau latéral animé qui présente la
// synthèse chiffrée du portefeuille projets : KPIs + camembert.
//
// Mode de répartition pour le camembert :
//   - par commission (combien de projets par commission)
//   - par budget (somme des investissements par commission)
// ═══════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
  projects: ProjectListItem[];
  totalDemande: number;
  totalObtenu: number;
}

type ChartMode = "by-commission-count" | "by-commission-budget";

const UNASSIGNED_KEY = "__unassigned__";
const UNASSIGNED_COLOR = "#c8c5bd";

export default function ProjectsStatsDrawer({
  open,
  onClose,
  projects,
  totalDemande,
  totalObtenu,
}: Props) {
  const [mode, setMode] = useState<ChartMode>("by-commission-count");

  // Échappe pour fermer + verrouille le scroll sous le drawer
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const totalInvest = useMemo(
    () => projects.reduce((s, p) => s + Number(p.budget_estime ?? 0), 0),
    [projects],
  );
  const resteACharge = totalInvest - totalObtenu;

  // Agrégation par commission (ou « Sans commission »)
  const slices: DonutSlice[] = useMemo(() => {
    const map = new Map<string, { label: string; color: string; value: number }>();
    for (const p of projects) {
      const budget = Number(p.budget_estime ?? 0);
      const commissions = p.commissions ?? [];
      if (commissions.length === 0) {
        const cur = map.get(UNASSIGNED_KEY) ?? {
          label: "Sans commission",
          color: UNASSIGNED_COLOR,
          value: 0,
        };
        cur.value += mode === "by-commission-count" ? 1 : budget;
        map.set(UNASSIGNED_KEY, cur);
        continue;
      }
      // Si un projet est sur plusieurs commissions, on incrémente chacune.
      // Pour le budget, on partage le budget équitablement entre commissions
      // (le total reste cohérent).
      const share = mode === "by-commission-count" ? 1 : budget / commissions.length;
      for (const c of commissions) {
        const cur = map.get(c.id) ?? {
          label: c.nom,
          color: c.color,
          value: 0,
        };
        cur.value += share;
        map.set(c.id, cur);
      }
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.value - a.value);
  }, [projects, mode]);

  const formatValue = (n: number): string =>
    mode === "by-commission-count"
      ? `${Math.round(n)} projet${Math.round(n) > 1 ? "s" : ""}`
      : formatEuros(n);

  const centerLabel = mode === "by-commission-count" ? "Projets" : "Investissement";
  const centerValue =
    mode === "by-commission-count"
      ? String(projects.length)
      : formatEuros(totalInvest);

  return (
    <>
      <div
        className={`pj-drawer-backdrop${open ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`pj-drawer${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Synthèse du portefeuille de projets"
        aria-hidden={!open}
      >
        <header className="pj-drawer-header">
          <div>
            <h2 className="pj-drawer-title">Synthèse du portefeuille</h2>
            <p className="pj-drawer-subtitle">
              Indicateurs clés et répartition par commission.
            </p>
          </div>
          <button
            type="button"
            className="pj-drawer-close"
            onClick={onClose}
            aria-label="Fermer le panneau"
          >
            <X size={18} />
          </button>
        </header>

        <div className="pj-drawer-body">
          {/* KPIs */}
          <div className="pj-drawer-kpis">
            <Kpi label="Projets" value={String(projects.length)} />
            <Kpi label="Investissement prévu" value={formatEuros(totalInvest)} />
            <Kpi label="Subventions demandées" value={formatEuros(totalDemande)} />
            <Kpi
              label="Subventions obtenues"
              value={formatEuros(totalObtenu)}
              tone="success"
            />
            <Kpi
              label="Reste à charge commune"
              value={formatEuros(resteACharge)}
              tone="warn"
            />
          </div>

          {/* Toggle mode camembert */}
          <div className="pj-drawer-section">
            <div className="pj-drawer-section-head">
              <h3>Répartition par commission</h3>
              <div className="pj-drawer-toggle" role="tablist" aria-label="Critère">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "by-commission-count"}
                  className={`pj-drawer-toggle-btn${
                    mode === "by-commission-count" ? " is-active" : ""
                  }`}
                  onClick={() => setMode("by-commission-count")}
                >
                  <ChartPie size={13} /> <span>Nombre</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "by-commission-budget"}
                  className={`pj-drawer-toggle-btn${
                    mode === "by-commission-budget" ? " is-active" : ""
                  }`}
                  onClick={() => setMode("by-commission-budget")}
                >
                  <Coins size={13} /> <span>Investissement</span>
                </button>
              </div>
            </div>

            <DonutChart
              data={slices}
              size={240}
              stroke={28}
              centerLabel={centerLabel}
              centerValue={centerValue}
              formatValue={formatValue}
            />
          </div>
        </div>
      </aside>
    </>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warn";
}) {
  return (
    <div className="pj-drawer-kpi">
      <div className="pj-drawer-kpi-label">{label}</div>
      <div
        className={`pj-drawer-kpi-value${
          tone === "success" ? " pj-text-success" : tone === "warn" ? " pj-text-warn" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
