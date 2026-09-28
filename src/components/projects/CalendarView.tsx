"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Diamond, Gavel, List, RotateCcw } from "lucide-react";
import {
  filtrerEvenements,
  libelleCategorie,
  registreVisuel,
  texteAccessible,
  type CalendarEvent,
  type CalendarFilters,
} from "@/lib/projects/calendar";
import { ETAPE_STATUT_META } from "@/lib/projects/etapes";
import { TYPE_META } from "./TypeBadge";

// ═══════════════════════════════════════════════════════════════
// Calendrier général (brief §2.11) — liste chronologique / mois.
//
// Deux dimensions visuelles distinctes :
//   • type de projet → fond de l'item + icône de type ;
//   • commission     → pastille de couleur en tête d'item.
// La couleur ne porte jamais seule l'information : le type figure dans
// le texte accessible, le retard est écrit en toutes lettres.
//
// Dates : heure murale stockée dans les composantes UTC ⇒ affichage en
// timeZone « UTC » (sinon décalage de 1 à 2 h).
// ═══════════════════════════════════════════════════════════════

interface Props {
  events: CalendarEvent[];
  commissions: Array<{ id: string; nom: string; color: string | null }>;
  referents: Array<{ id: string; nom: string }>;
}

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAYS = [
  { court: "L", long: "Lundi" }, { court: "M", long: "Mardi" }, { court: "M", long: "Mercredi" },
  { court: "J", long: "Jeudi" }, { court: "V", long: "Vendredi" }, { court: "S", long: "Samedi" }, { court: "D", long: "Dimanche" },
];

function TypeIcon({ e, size = 14 }: { e: Pick<CalendarEvent, "typeCode">; size?: number }) {
  if (!e.typeCode) return <Gavel size={size} aria-hidden="true" />;
  const { Icon } = TYPE_META[e.typeCode];
  return <Icon size={size} aria-hidden="true" />;
}

function dateCourte(e: CalendarEvent): string {
  const d = new Date(e.date);
  const jour = d.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });
  if (e.allDay) return jour;
  return `${jour} · ${d.getUTCHours()}h${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function sousTitre(e: CalendarEvent): string {
  if (e.kind === "seance") return e.lieu ? `Lieu : ${e.lieu}` : "Séance de commission";
  if (e.kind === "evenement") return ["Date de l'événement", e.lieu].filter(Boolean).join(" · ");
  const parts = [e.projectName];
  if (e.datePrevue) parts.push(`prévue le ${new Date(e.datePrevue).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" })}`);
  return parts.filter(Boolean).join(" · ");
}

export default function CalendarView({ events, commissions, referents }: Props) {
  const [mode, setMode] = useState<"list" | "month">("list");
  const [showPast, setShowPast] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>({});
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const filtered = useMemo(() => filtrerEvenements(events, filters), [events, filters]);
  const actif = !!(filters.type || filters.commissionId || filters.statut || filters.referentId);
  const today = localToday();

  // Liste : à venir + en retard toujours ; passés sur demande.
  const listEvents = filtered.filter((e) => e.date.slice(0, 10) >= today || e.overdue || showPast);
  const pastCount = filtered.filter((e) => e.date.slice(0, 10) < today && !e.overdue).length;

  const byMonth = new Map<string, CalendarEvent[]>();
  for (const e of listEvents) {
    const ym = e.date.slice(0, 7);
    byMonth.set(ym, [...(byMonth.get(ym) ?? []), e]);
  }
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of filtered) {
    const d = e.date.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }

  const firstDay = new Date(cursor.year, cursor.month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const shift = (n: number) =>
    setCursor((c) => {
      const m = c.month + n;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  const set = (patch: Partial<CalendarFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <>
      {/* Légende : type = fond + icône ; commission = pastille. */}
      <section className="pj-cal-legend" aria-labelledby="cal-legende">
        <h2 id="cal-legende" className="pj-cal-legend-title">Légende</h2>
        <ul className="pj-cal-legend-list">
          {(["investissement", "evenementiel", "suivi_simple"] as const).map((t) => (
            <li key={t} className={`pj-cal-legend-item pj-cal-reg-${registreVisuel({ typeCode: t })}`}>
              <span className="pj-cal-type-icon"><TypeIcon e={{ typeCode: t }} /></span>
              {TYPE_META[t].label}
            </li>
          ))}
          <li className="pj-cal-legend-item pj-cal-reg-session">
            <span className="pj-cal-type-icon"><Gavel size={14} aria-hidden="true" /></span>
            Séance de commission
          </li>
          <li className="pj-cal-legend-item pj-cal-legend-plain">
            <span className="pj-cal-comm-dot" style={{ background: "var(--fg-muted)" }} aria-hidden="true" />
            Pastille : couleur de la commission
          </li>
          <li className="pj-cal-legend-item pj-cal-legend-plain">
            <Diamond size={13} aria-hidden="true" /> Jalon
          </li>
          <li className="pj-cal-legend-item pj-cal-legend-plain pj-cal-legend-late">
            <AlertTriangle size={13} aria-hidden="true" /> En retard
          </li>
        </ul>
      </section>

      {/* Filtres */}
      <div className="pj-cal-filters" role="group" aria-label="Filtrer le calendrier">
        <div className="civiq-field">
          <label htmlFor="cal-f-type" className="civiq-field-label">Type</label>
          <select id="cal-f-type" className="civiq-input" value={filters.type ?? ""} onChange={(e) => set({ type: e.target.value as CalendarFilters["type"] })}>
            <option value="">Tous</option>
            <option value="investissement">Investissement</option>
            <option value="evenementiel">Événement</option>
            <option value="suivi_simple">Suivi simple</option>
            <option value="seance">Séances de commission</option>
          </select>
        </div>
        <div className="civiq-field">
          <label htmlFor="cal-f-comm" className="civiq-field-label">Commission</label>
          <select id="cal-f-comm" className="civiq-input" value={filters.commissionId ?? ""} onChange={(e) => set({ commissionId: e.target.value })}>
            <option value="">Toutes</option>
            {commissions.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div className="civiq-field">
          <label htmlFor="cal-f-statut" className="civiq-field-label">Statut d&apos;étape</label>
          <select id="cal-f-statut" className="civiq-input" value={filters.statut ?? ""} onChange={(e) => set({ statut: e.target.value as CalendarFilters["statut"] })}>
            <option value="">Tous</option>
            <option value="a_faire">À faire</option>
            <option value="en_cours">En cours</option>
            <option value="termine">Terminé</option>
            <option value="retard">En retard</option>
          </select>
        </div>
        <div className="civiq-field">
          <label htmlFor="cal-f-ref" className="civiq-field-label">Élu référent</label>
          <select id="cal-f-ref" className="civiq-input" value={filters.referentId ?? ""} onChange={(e) => set({ referentId: e.target.value })}>
            <option value="">Tous</option>
            {referents.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
        </div>
        {actif && (
          <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm pj-cal-filters-reset" onClick={() => setFilters({})}>
            <RotateCcw size={14} aria-hidden="true" /> Tout afficher
          </button>
        )}
      </div>
      <p className="pj-cal-count" role="status">
        {filtered.length} date{filtered.length > 1 ? "s" : ""}{actif ? " correspondant aux filtres" : ""}.
      </p>

      <div className="pj-cal-controls">
        <div className="pj-cal-tabs" role="group" aria-label="Affichage">
          <button type="button" onClick={() => setMode("list")} aria-pressed={mode === "list"} className={`pj-cal-tab ${mode === "list" ? "is-active" : ""}`}>
            <List size={14} aria-hidden="true" /> Chronologique
          </button>
          <button type="button" onClick={() => setMode("month")} aria-pressed={mode === "month"} className={`pj-cal-tab ${mode === "month" ? "is-active" : ""}`}>
            <Calendar size={14} aria-hidden="true" /> Mois
          </button>
        </div>
        {mode === "list" && pastCount > 0 && (
          <label className="pj-cal-future-toggle">
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
            <span>Afficher les {pastCount} date{pastCount > 1 ? "s" : ""} passée{pastCount > 1 ? "s" : ""}</span>
          </label>
        )}
      </div>

      {mode === "list" && (
        <div className="pj-cal-list">
          {listEvents.length === 0 ? (
            <p className="pj-section-empty">
              {actif ? "Aucune date ne correspond à ces filtres." : "Aucune date à venir."}
              {!showPast && pastCount > 0 && <> Cochez « Afficher les dates passées » pour voir l&apos;historique.</>}
            </p>
          ) : (
            [...byMonth.entries()].map(([ym, evs]) => {
              const [y, m] = ym.split("-").map(Number);
              return (
                <div key={ym} className="pj-cal-month-block">
                  <h3 className="pj-cal-month-title">{MONTHS[m - 1]} {y}</h3>
                  <ul className="pj-cal-events">
                    {evs.map((e) => (
                      <li key={e.id} className={`pj-cal-event pj-cal-reg-${registreVisuel(e)} ${e.overdue ? "is-overdue" : ""}`}>
                        <div className="pj-cal-event-date">{dateCourte(e)}</div>
                        <Link href={e.href} className="pj-cal-event-body" prefetch={false}>
                          <span className="pj-cal-type-icon"><TypeIcon e={e} /></span>
                          <span className="pj-cal-event-main">
                            <span className="pj-sr-only">{texteAccessible(e)}. </span>
                            <span className="pj-cal-event-title" aria-hidden="true">
                              {e.commission && <span className="pj-cal-comm-dot" style={{ background: e.commission.color ?? "var(--fg-muted)" }} />}
                              {e.estJalon && e.kind === "etape" && <Diamond size={12} className="pj-cal-jalon" />}
                              {e.title}
                            </span>
                            <span className="pj-cal-event-sub" aria-hidden="true">
                              {libelleCategorie(e)}{e.commission && e.kind !== "seance" ? ` · ${e.commission.nom}` : ""} · {sousTitre(e)}
                            </span>
                          </span>
                          <span className="pj-cal-event-badges" aria-hidden="true">
                            {e.overdue && <span className="pj-cal-badge-late"><AlertTriangle size={12} /> En retard</span>}
                            {e.statut && !e.overdue && <span className="pj-cal-badge-statut" style={{ background: ETAPE_STATUT_META[e.statut].bg }}>{ETAPE_STATUT_META[e.statut].label}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      )}

      {mode === "month" && (
        <div className="pj-cal-month">
          <div className="pj-cal-month-nav">
            <button type="button" onClick={() => shift(-1)} className="civiq-btn civiq-btn-ghost civiq-btn-sm" aria-label="Mois précédent">
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <h3 className="pj-cal-month-current" aria-live="polite">{MONTHS[cursor.month]} {cursor.year}</h3>
            <button type="button" onClick={() => shift(1)} className="civiq-btn civiq-btn-ghost civiq-btn-sm" aria-label="Mois suivant">
              <ChevronRight size={14} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); }} className="civiq-btn civiq-btn-outline civiq-btn-sm">
              Aujourd&apos;hui
            </button>
          </div>
          <div className="pj-cal-grid">
            {DAYS.map((d, i) => (
              <div key={i} className="pj-cal-day-head"><abbr title={d.long}>{d.court}</abbr></div>
            ))}
            {Array.from({ length: startOffset }).map((_, i) => <div key={`b${i}`} className="pj-cal-day pj-cal-day-blank" aria-hidden="true" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const evs = byDay.get(iso) ?? [];
              return (
                <div key={day} className={`pj-cal-day ${iso === today ? "is-today" : ""}`}>
                  <span className="pj-cal-day-num">{day}</span>
                  {evs.length > 0 && (
                    <ul className="pj-cal-day-events">
                      {evs.slice(0, 3).map((e) => (
                        <li key={e.id}>
                          <Link href={e.href} prefetch={false} title={texteAccessible(e)}
                            className={`pj-cal-day-event pj-cal-reg-${registreVisuel(e)} ${e.overdue ? "is-overdue" : ""}`}>
                            <span className="pj-sr-only">{day} {MONTHS[cursor.month]} : {texteAccessible(e)}</span>
                            <span className="pj-cal-day-event-title" aria-hidden="true">
                              <span className="pj-cal-type-icon-sm"><TypeIcon e={e} size={11} /></span>
                              {e.commission && <span className="pj-cal-comm-dot" style={{ background: e.commission.color ?? "var(--fg-muted)" }} />}
                              {e.overdue && <AlertTriangle size={11} className="pj-cal-late-icon" />}
                              <span className="pj-cal-day-event-text">{e.kind === "seance" ? "Séance" : e.title}</span>
                            </span>
                            <span className="pj-cal-day-event-sub" aria-hidden="true">
                              {e.kind === "seance" ? e.commission?.nom : e.kind === "evenement" ? e.lieu : e.projectName}
                            </span>
                          </Link>
                        </li>
                      ))}
                      {evs.length > 3 && (
                        <li className="pj-cal-day-more">
                          <button type="button" className="pj-link-btn" onClick={() => { setMode("list"); setShowPast(true); }}>
                            +{evs.length - 3}<span className="pj-sr-only"> autres dates : voir la liste</span>
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
