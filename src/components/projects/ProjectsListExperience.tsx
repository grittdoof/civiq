"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Filter,
  X,
  Handshake,
  Building2,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { Lock } from "lucide-react";
import type { AlertesProjet, StatutProjet } from "@/lib/projects/pilotage";
import type { TypeProjetCode } from "@/lib/projects/types";
import { formatEuros } from "@/lib/projects/cost-calc";
import { avancementAffiche } from "@/lib/projects/etapes";
import TypeBadge, { TYPE_META } from "./TypeBadge";
import type { ProjectListItem } from "@/lib/projects/queries";

// ═══════════════════════════════════════════════════════════════
// ProjectsListExperience — orchestration client de la vue Liste :
//   - recherche texte, filtres (type, commission)
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
  /** Totaux des lignes budget par projet (id → dépense/recette cumulées). */
  budgetTotalsByProject?: Record<string, { depense: number; recette: number }>;
  /** Badges d'alerte (retard, subvention sans accusé de réception, part communale, délégation). */
  alertes?: Record<string, AlertesProjet>;
  /** En cours / terminé (toutes les étapes terminées). */
  statuts?: Record<string, StatutProjet>;
}

const PAGE = 30;

const TYPES: TypeProjetCode[] = ["investissement", "evenementiel", "suivi_simple"];

export default function ProjectsListExperience({
  projects,
  totalDemande,
  totalObtenu,
  budgetTotalsByProject = {},
  alertes = {},
  statuts = {},
}: Props) {
  const [statutSelected, setStatutSelected] = useState<StatutProjet | "">("");
  const [visibles, setVisibles] = useState(PAGE);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [typesSelected, setTypesSelected] = useState<Set<TypeProjetCode>>(new Set());
  const [search, setSearch] = useState("");
  const [commissionsSelected, setCommissionsSelected] = useState<Set<string>>(
    new Set(),
  );

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
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (typesSelected.size > 0 && !typesSelected.has((p.type_code ?? "suivi_simple") as TypeProjetCode)) {
        return false;
      }
      if (q && !`${p.titre} ${p.description ?? ""}`.toLowerCase().includes(q)) return false;
      if (commissionsSelected.size > 0) {
        const ids = (p.commissions ?? []).map((c) => c.id);
        if (!ids.some((id) => commissionsSelected.has(id))) return false;
      }
      if (statutSelected && (statuts[p.id] ?? "en_cours") !== statutSelected) return false;
      return true;
    });
  }, [projects, typesSelected, commissionsSelected, search, statutSelected, statuts]);

  const toggleType = (t: TypeProjetCode) => {
    setTypesSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
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
    setTypesSelected(new Set());
    setCommissionsSelected(new Set());
    setSearch("");
    setStatutSelected("");
  };

  const activeFilterCount = typesSelected.size + commissionsSelected.size + (search.trim() ? 1 : 0) + (statutSelected ? 1 : 0);

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
        <div className="pj-list-toolbar-actions">
          <div className="pj-list-search">
            <Search size={14} aria-hidden="true" />
            <label htmlFor="pj-search" className="pj-sr-only">Rechercher un projet</label>
            <input id="pj-search" type="search" className="civiq-input" placeholder="Rechercher un projet…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button
            type="button"
            className="pj-list-toolbar-stats civiq-btn civiq-btn-outline"
            onClick={() => setFiltersDrawerOpen((o) => !o)}
            aria-controls="pj-filtres"
            aria-expanded={filtersDrawerOpen}
          >
            <SlidersHorizontal size={14} />
            <span>Filtres</span>
            {activeFilterCount > 0 && (
              <span className="pj-toolbar-badge">{activeFilterCount}</span>
            )}
          </button>
          <Link href="/admin/projects?onglet=statistiques" className="pj-list-toolbar-stats civiq-btn civiq-btn-outline" prefetch={false}>
            <BarChart3 size={14} aria-hidden="true" />
            <span>Statistiques</span>
          </Link>
        </div>
      </div>

      {filtersDrawerOpen && (
        <div id="pj-filtres" className="pj-filters-inline civiq-card">
          <FiltersBar
            typesSelected={typesSelected}
            onToggleType={toggleType}
            commissions={allCommissions}
            commissionsSelected={commissionsSelected}
            onToggleCommission={toggleCommission}
            statut={statutSelected}
            onStatut={setStatutSelected}
          />
          <div className="pj-filters-inline-foot">
            {activeFilterCount > 0 && (
              <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={resetFilters}>
                <X size={13} aria-hidden="true" /> Réinitialiser
              </button>
            )}
            <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={() => setFiltersDrawerOpen(false)}>Fermer</button>
          </div>
        </div>
      )}

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
        <>
          <CleanProjectList
            projects={filteredProjects.slice(0, visibles)}
            budgetTotalsByProject={budgetTotalsByProject}
            alertes={alertes}
          />
          {filteredProjects.length > visibles && (
            <div className="pj-list-more">
              <button type="button" className="civiq-btn civiq-btn-outline" onClick={() => setVisibles((v) => v + PAGE)}>
                Afficher {Math.min(PAGE, filteredProjects.length - visibles)} projets de plus
              </button>
              <span className="pj-list-muted">{visibles} affichés sur {filteredProjects.length}</span>
            </div>
          )}
        </>
      )}

    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Barre de filtres (puces multi-sélection + segmented control)
// ─────────────────────────────────────────────────────────────────

function FiltersBar({
  typesSelected,
  onToggleType,
  commissions,
  commissionsSelected,
  onToggleCommission,
  statut,
  onStatut,
}: {
  typesSelected: Set<TypeProjetCode>;
  onToggleType: (t: TypeProjetCode) => void;
  commissions: CommissionDescriptor[];
  commissionsSelected: Set<string>;
  onToggleCommission: (id: string) => void;
  statut: StatutProjet | "";
  onStatut: (s: StatutProjet | "") => void;
}) {
  return (
    <div className="pj-filters">
      <div className="pj-filters-group">
        <span className="pj-filters-label">Statut</span>
        <div className="pj-filters-chips">
          {([["", "Tous"], ["en_cours", "En cours"], ["termine", "Terminés"]] as const).map(([v, label]) => (
            <button key={v || "tous"} type="button" className={`pj-filter-chip${statut === v ? " is-active" : ""}`}
              onClick={() => onStatut(v)} aria-pressed={statut === v}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="pj-filters-group">
        <span className="pj-filters-label">Type de projet</span>
        <div className="pj-filters-chips">
          {TYPES.map((t) => {
            const active = typesSelected.has(t);
            const meta = TYPE_META[t];
            return (
              <button
                key={t}
                type="button"
                className={`pj-filter-chip${active ? " is-active" : ""}`}
                onClick={() => onToggleType(t)}
                aria-pressed={active}
              >
                <meta.Icon size={12} aria-hidden="true" />
                <span>{meta.label}</span>
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

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CleanProjectList — version épurée de la liste (sans header
// pj-list-col-*, juste les lignes de projets).
// ─────────────────────────────────────────────────────────────────

function BadgesAlerte({ a, confidentiel }: { a?: AlertesProjet; confidentiel: boolean }) {
  if (!a && !confidentiel) return null;
  return (
    <span className="pj-list-alertes">
      {confidentiel && <span className="civiq-badge pj-badge-confidentiel"><Lock size={11} aria-hidden="true" /> Confidentiel</span>}
      {a && a.retards > 0 && <span className="civiq-badge civiq-badge-warning">{a.retards} en retard</span>}
      {a && a.subventionsSansAr > 0 && <span className="civiq-badge civiq-badge-warning">Subvention sans accusé de réception</span>}
      {a?.partCommuneKo && <span className="civiq-badge civiq-badge-error">Part communale sous 20 %</span>}
      {a?.delegationDepassee && <span className="civiq-badge civiq-badge-error">Au-delà de la délégation du maire</span>}
    </span>
  );
}

function CleanProjectList({
  projects,
  budgetTotalsByProject,
  alertes,
}: {
  projects: ProjectListItem[];
  budgetTotalsByProject: Record<string, { depense: number; recette: number }>;
  alertes: Record<string, AlertesProjet>;
}) {
  return (
    <ul className="pj-list">
      {projects.map((p) => {
        const demande = p.financing_total_demande ?? 0;
        const obtenu = p.financing_total_obtenu ?? 0;
        const budgetEstime = Number(p.budget_estime ?? 0);
        const budgetLines = budgetTotalsByProject[p.id] ?? { depense: 0, recette: 0 };
        // Budget affiché selon le gabarit :
        //  - investment : budget_estime (enveloppe indicative + coût 10 ans)
        //  - event/tracking : total des dépenses saisies OU budget_estime en fallback
        const budget = p.type === "investment"
          ? budgetEstime
          : (budgetLines.depense > 0 ? budgetLines.depense : budgetEstime);
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
              <div className="pj-list-titre-wrap">
                <div
                  className={`pj-list-thumb${p.photo_url ? " has-photo" : ""}`}
                  aria-hidden
                >
                  {p.photo_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.photo_url} alt="" loading="lazy" />
                  )}
                </div>
                <div className="pj-list-titre-cell">
                  <strong className="pj-list-titre">{p.titre}</strong>
                  <div className="pj-list-meta">
                    <span className="pj-list-referent">
                      <UserRound size={11} aria-hidden="true" />{" "}
                      {p.pilote_elu_profile?.full_name ?? "Élu référent à désigner"}
                    </span>
                    {p.concerne_tiers && (
                      <span className="pj-list-pill pj-list-pill-tiers">
                        <Handshake size={11} aria-hidden /> Tiers
                        {p.accompagne_sans_financer ? " · non financé" : ""}
                      </span>
                    )}
                    <BadgesAlerte a={alertes[p.id]} confidentiel={!!(p as { confidentiel?: boolean }).confidentiel} />
                    {p.description && (
                      <span className="pj-list-desc">{p.description}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pj-list-phase-cell">
                <TypeBadge type={(p.type_code ?? "suivi_simple") as TypeProjetCode} size="sm" />
                <span className="pj-list-phase-label">
                  {(() => {
                    const a = avancementAffiche(p);
                    return a.pct === null ? "Avancement non renseigné" : `Avancement ${Math.round(a.pct)} %`;
                  })()}
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
                <span className="pj-list-budget">
                  {budget > 0 ? formatEuros(budget) : <span className="pj-list-muted">—</span>}
                </span>
                {p.type !== "investment" && budgetLines.depense > 0 && (
                  <span className="pj-list-financement-meta">
                    dépenses saisies
                  </span>
                )}
              </div>

              <div className="pj-list-financement-cell">
                {p.type === "investment" ? (
                  p.accompagne_sans_financer ? (
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
                  )
                ) : p.type === "event" ? (
                  budgetLines.recette > 0 ? (
                    <>
                      <span className="pj-list-budget">{formatEuros(budgetLines.recette)}</span>
                      <span className="pj-list-financement-meta">recettes propres</span>
                    </>
                  ) : (
                    <span className="pj-list-muted">—</span>
                  )
                ) : (
                  // tracking : pas de logique financement structurante
                  obtenu > 0 || demande > 0 ? (
                    <span className="pj-list-financement-meta">
                      {formatEuros(obtenu)} obtenu
                    </span>
                  ) : (
                    <span className="pj-list-muted">—</span>
                  )
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
