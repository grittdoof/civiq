"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Filter,
  X,
  Handshake,
  Building2,
} from "lucide-react";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  type ProjectPhase,
} from "@/lib/projects/types";
import { formatEuros } from "@/lib/projects/cost-calc";
import PhaseIcon from "./PhaseIcon";
import ProjectsStatsDrawer from "./ProjectsStatsDrawer";
import type { ProjectListItem } from "@/lib/projects/queries";

// ═══════════════════════════════════════════════════════════════
// ProjectsListExperience — orchestration client de la vue Liste :
//   - filtres (phase, commission, tiers)
//   - bouton Statistiques qui ouvre le drawer off-canvas
//   - liste filtrée des projets
//
// Le serveur fournit les projets bruts (déjà enrichis de
// commissions par listProjects) + les totaux financements.
// Tout le reste est calculé localement pour rester réactif.
// ═══════════════════════════════════════════════════════════════

interface CommissionDescriptor {
  id: string;
  nom: string;
  color: string;
}

interface Props {
  projects: ProjectListItem[];
  totalDemande: number;
  totalObtenu: number;
}

const TIERS_FILTERS = [
  { value: "all", label: "Tous" },
  { value: "commune", label: "Commune" },
  { value: "tiers", label: "Tiers" },
] as const;

type TiersFilter = (typeof TIERS_FILTERS)[number]["value"];

export default function ProjectsListExperience({
  projects,
  totalDemande,
  totalObtenu,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [phasesSelected, setPhasesSelected] = useState<Set<ProjectPhase>>(
    new Set(),
  );
  const [commissionsSelected, setCommissionsSelected] = useState<Set<string>>(
    new Set(),
  );
  const [tiersFilter, setTiersFilter] = useState<TiersFilter>("all");

  // Liste des commissions présentes dans le portefeuille
  // (dérivée des projets pour ne proposer que des filtres utiles).
  const allCommissions: CommissionDescriptor[] = useMemo(() => {
    const map = new Map<string, CommissionDescriptor>();
    for (const p of projects) {
      for (const c of p.commissions ?? []) {
        if (!map.has(c.id)) {
          map.set(c.id, { id: c.id, nom: c.nom, color: c.color });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (phasesSelected.size > 0 && !phasesSelected.has(p.phase as ProjectPhase)) {
        return false;
      }
      if (commissionsSelected.size > 0) {
        const ids = (p.commissions ?? []).map((c) => c.id);
        if (!ids.some((id) => commissionsSelected.has(id))) return false;
      }
      if (tiersFilter === "tiers" && !p.concerne_tiers) return false;
      if (tiersFilter === "commune" && p.concerne_tiers) return false;
      return true;
    });
  }, [projects, phasesSelected, commissionsSelected, tiersFilter]);

  const togglePhase = (phase: ProjectPhase) => {
    setPhasesSelected((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  const toggleCommission = (id: string) => {
    setCommissionsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    setPhasesSelected(new Set());
    setCommissionsSelected(new Set());
    setTiersFilter("all");
  };

  const activeFilterCount =
    phasesSelected.size +
    commissionsSelected.size +
    (tiersFilter !== "all" ? 1 : 0);

  return (
    <>
      <div className="pj-list-toolbar">
        <div className="pj-list-toolbar-meta">
          <span className="pj-list-toolbar-count">
            {filteredProjects.length}
            {filteredProjects.length === projects.length ? (
              <span className="pj-list-toolbar-total"> projets</span>
            ) : (
              <span className="pj-list-toolbar-total">
                {" "}sur {projects.length}
              </span>
            )}
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="pj-list-toolbar-reset"
              onClick={resetFilters}
            >
              <X size={12} /> Réinitialiser les filtres
            </button>
          )}
        </div>
        <button
          type="button"
          className="pj-list-toolbar-stats civiq-btn civiq-btn-outline"
          onClick={() => setDrawerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
        >
          <BarChart3 size={14} />
          <span>Statistiques</span>
        </button>
      </div>

      <FiltersBar
        phasesSelected={phasesSelected}
        onTogglePhase={togglePhase}
        commissions={allCommissions}
        commissionsSelected={commissionsSelected}
        onToggleCommission={toggleCommission}
        tiersFilter={tiersFilter}
        onTiersFilterChange={setTiersFilter}
      />

      {filteredProjects.length === 0 ? (
        <div className="civiq-card pj-empty pj-empty-soft">
          <Filter size={28} aria-hidden style={{ opacity: 0.4 }} />
          <p className="pj-empty-title">Aucun projet ne correspond aux filtres</p>
          <p className="pj-empty-hint">
            Modifiez vos critères ou réinitialisez les filtres pour voir
            l&apos;ensemble du portefeuille.
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="civiq-btn civiq-btn-outline"
              onClick={resetFilters}
            >
              Réinitialiser
            </button>
          )}
        </div>
      ) : (
        <CleanProjectList projects={filteredProjects} />
      )}

      <ProjectsStatsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        projects={filteredProjects}
        totalDemande={totalDemande}
        totalObtenu={totalObtenu}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Barre de filtres (puces multi-sélection + segmented control)
// ─────────────────────────────────────────────────────────────────

function FiltersBar({
  phasesSelected,
  onTogglePhase,
  commissions,
  commissionsSelected,
  onToggleCommission,
  tiersFilter,
  onTiersFilterChange,
}: {
  phasesSelected: Set<ProjectPhase>;
  onTogglePhase: (p: ProjectPhase) => void;
  commissions: CommissionDescriptor[];
  commissionsSelected: Set<string>;
  onToggleCommission: (id: string) => void;
  tiersFilter: TiersFilter;
  onTiersFilterChange: (v: TiersFilter) => void;
}) {
  return (
    <div className="pj-filters">
      <div className="pj-filters-group">
        <span className="pj-filters-label">Étape</span>
        <div className="pj-filters-chips">
          {PROJECT_PHASES.map((phase) => {
            const active = phasesSelected.has(phase);
            return (
              <button
                key={phase}
                type="button"
                className={`pj-filter-chip${active ? " is-active" : ""}`}
                onClick={() => onTogglePhase(phase)}
                aria-pressed={active}
              >
                <PhaseIcon phase={phase} size={12} strokeWidth={2} />
                <span>{PROJECT_PHASE_LABELS[phase]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {commissions.length > 0 && (
        <div className="pj-filters-group">
          <span className="pj-filters-label">
            <Building2 size={11} aria-hidden /> Commission
          </span>
          <div className="pj-filters-chips">
            {commissions.map((c) => {
              const active = commissionsSelected.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`pj-filter-chip pj-filter-chip-commission${
                    active ? " is-active" : ""
                  }`}
                  onClick={() => onToggleCommission(c.id)}
                  aria-pressed={active}
                  style={{
                    borderColor: active ? c.color : undefined,
                    background: active ? `${c.color}18` : undefined,
                    color: active ? c.color : undefined,
                  }}
                >
                  <span
                    className="pj-filter-chip-dot"
                    style={{ background: c.color }}
                    aria-hidden
                  />
                  <span>{c.nom}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="pj-filters-group">
        <span className="pj-filters-label">
          <Handshake size={11} aria-hidden /> Porteur
        </span>
        <div className="pj-filters-segment">
          {TIERS_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`pj-filters-segment-btn${
                tiersFilter === opt.value ? " is-active" : ""
              }`}
              onClick={() => onTiersFilterChange(opt.value)}
              aria-pressed={tiersFilter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CleanProjectList — version épurée de la liste (sans header
// pj-list-col-*, juste les lignes de projets).
// ─────────────────────────────────────────────────────────────────

function CleanProjectList({ projects }: { projects: ProjectListItem[] }) {
  return (
    <ul className="pj-list">
      {projects.map((p) => {
        const demande = p.financing_total_demande ?? 0;
        const obtenu = p.financing_total_obtenu ?? 0;
        const budget = Number(p.budget_estime ?? 0);
        const pctObtenu = budget > 0 ? Math.min(100, Math.round((obtenu / budget) * 100)) : 0;
        const pctDemande = budget > 0 ? Math.min(100, Math.round((demande / budget) * 100)) : 0;

        return (
          <li key={p.id} className="pj-list-item-wrap">
            <div className="pj-list-bars" aria-hidden>
              {(p.commissions ?? []).length === 0 ? (
                <span className="pj-list-bar pj-list-bar-empty" />
              ) : (
                (p.commissions ?? []).map((c) => (
                  <span
                    key={c.id}
                    className="pj-list-bar"
                    style={{ background: c.color }}
                    title={c.nom}
                  />
                ))
              )}
            </div>

            <Link
              href={`/admin/projects/${p.id}`}
              className="pj-list-item"
              prefetch={false}
            >
              <div className="pj-list-titre-cell">
                <strong className="pj-list-titre">{p.titre}</strong>
                <div className="pj-list-meta">
                  {p.concerne_tiers && (
                    <span className="pj-list-pill pj-list-pill-tiers">
                      <Handshake size={11} aria-hidden /> Tiers
                      {p.accompagne_sans_financer ? " · non financé" : ""}
                    </span>
                  )}
                  {p.description && (
                    <span className="pj-list-desc">{p.description}</span>
                  )}
                </div>
              </div>

              <div className="pj-list-phase-cell">
                <div className="pj-list-phase-badge">
                  <PhaseIcon phase={p.phase as ProjectPhase} size={14} strokeWidth={2} />
                </div>
                <span className="pj-list-phase-label">
                  {PROJECT_PHASE_LABELS[p.phase as ProjectPhase]}
                </span>
              </div>

              <div className="pj-list-commissions-cell">
                {(p.commissions ?? []).length === 0 ? (
                  <span className="pj-list-muted">—</span>
                ) : (
                  (p.commissions ?? []).map((c) => (
                    <span
                      key={c.id}
                      className="pj-list-commission-chip"
                      style={{
                        background: `${c.color}18`,
                        color: c.color,
                        borderColor: `${c.color}40`,
                      }}
                      title={c.nom}
                    >
                      {c.nom}
                    </span>
                  ))
                )}
              </div>

              <div className="pj-list-budget-cell">
                <span className="pj-list-budget">{formatEuros(budget)}</span>
              </div>

              <div className="pj-list-financement-cell">
                {p.accompagne_sans_financer ? (
                  <span className="pj-list-muted">—</span>
                ) : budget > 0 ? (
                  <>
                    <div className="pj-list-progress" aria-hidden>
                      <div
                        className="pj-list-progress-demande"
                        style={{ width: `${pctDemande}%` }}
                      />
                      <div
                        className="pj-list-progress-obtenu"
                        style={{ width: `${pctObtenu}%` }}
                      />
                    </div>
                    <span className="pj-list-financement-meta">
                      {formatEuros(obtenu)} obtenu · {formatEuros(demande)} demandé
                    </span>
                  </>
                ) : (
                  <span className="pj-list-muted">Budget non défini</span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
