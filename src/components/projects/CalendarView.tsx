"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, List, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/lib/projects/calendar-queries";
import CommissionIcon from "./CommissionIcon";

interface Props {
  events: CalendarEvent[];
}

// ═══════════════════════════════════════════════════════════════
// Vue calendrier — bascule liste chronologique / vue mensuelle.
//
// Liste : les événements en cours (passés non clos + aujourd'hui)
//   sont affichés du plus récent au plus lointain. Les futurs sont
//   masqués derrière un toggle "Inclure les événements à venir".
//
// Mois : grille semaine (lundi-dimanche) avec, pour chaque jour,
//   les événements en mini-cards portant la couleur de leur
//   commission (séances) ou la couleur par défaut (étapes clés).
//   Affichage du nom + sujet, dans la limite de l'espace.
// ═══════════════════════════════════════════════════════════════

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

export default function CalendarView({ events }: Props) {
  const [mode, setMode] = useState<"list" | "month">("list");
  const [showFuture, setShowFuture] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  function prevMonth() {
    setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
  }
  function nextMonth() {
    setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });
  }
  function goToday() {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  // ─── Liste : « en cours » = passés non clos + futurs si showFuture ─
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const listEvents = events
    .filter((e) => {
      const d = new Date(e.date);
      // En cours : pas dans le futur OU overdue (signal de retard)
      if (d <= todayMidnight || e.overdue) return true;
      // Futur : seulement si toggle activé
      return showFuture;
    })
    // Tri du plus récent au plus lointain : DESC
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group events par mois (en gardant l'ordre DESC global)
  const monthOrder: string[] = [];
  const eventsByMonth = new Map<string, CalendarEvent[]>();
  for (const e of listEvents) {
    const ym = e.date.slice(0, 7);
    if (!eventsByMonth.has(ym)) {
      eventsByMonth.set(ym, []);
      monthOrder.push(ym);
    }
    eventsByMonth.get(ym)!.push(e);
  }

  // Group events par jour pour la vue mois
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const day = e.date.slice(0, 10);
    const arr = eventsByDay.get(day) ?? [];
    arr.push(e);
    eventsByDay.set(day, arr);
  }

  // Construction de la grille du mois
  const firstDay = new Date(cursor.year, cursor.month, 1);
  const lastDay = new Date(cursor.year, cursor.month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  const isToday = (y: number, m: number, d: number) =>
    today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  const futureCount = events.filter(
    (e) => new Date(e.date) > todayMidnight && !e.overdue,
  ).length;

  return (
    <>
      <div className="pj-cal-controls">
        <div className="pj-cal-tabs">
          <button
            type="button"
            onClick={() => setMode("list")}
            className={`pj-cal-tab ${mode === "list" ? "is-active" : ""}`}
          >
            <List size={14} /> Chronologique
          </button>
          <button
            type="button"
            onClick={() => setMode("month")}
            className={`pj-cal-tab ${mode === "month" ? "is-active" : ""}`}
          >
            <Calendar size={14} /> Mois
          </button>
        </div>
        {mode === "list" && futureCount > 0 && (
          <label className="pj-cal-future-toggle">
            <input
              type="checkbox"
              checked={showFuture}
              onChange={(e) => setShowFuture(e.target.checked)}
            />
            <span>Inclure les {futureCount} événement{futureCount > 1 ? "s" : ""} à venir</span>
          </label>
        )}
      </div>

      {mode === "list" && (
        <div className="pj-cal-list">
          {listEvents.length === 0 ? (
            <p className="pj-section-empty">
              Aucun événement en cours.
              {!showFuture && futureCount > 0 && (
                <> Cochez la case ci-dessus pour voir les {futureCount} événement{futureCount > 1 ? "s" : ""} à venir.</>
              )}
            </p>
          ) : (
            monthOrder.map((ym) => {
              const [y, m] = ym.split("-").map(Number);
              const evs = eventsByMonth.get(ym)!;
              return (
                <div key={ym} className="pj-cal-month-block">
                  <h3 className="pj-cal-month-title">{MONTHS[m - 1]} {y}</h3>
                  <ul className="pj-cal-events">
                    {evs.map((e) => (
                      <li key={e.id} className={`pj-cal-event ${e.overdue ? "is-overdue" : ""}`}>
                        <div className="pj-cal-event-date">
                          {new Date(e.date).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "short",
                            ...(e.date.length > 10 ? { hour: "2-digit", minute: "2-digit" } : {}),
                          })}
                        </div>
                        <Link href={e.href} className="pj-cal-event-body" prefetch={false}>
                          <span
                            className="pj-cal-event-pill"
                            style={{ background: e.color }}
                            aria-hidden
                          >
                            <CommissionIcon name={e.icon} size={14} color="#fff" />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span className="pj-cal-event-title">{e.title}</span>
                            {e.subtitle && (
                              <span className="pj-cal-event-sub">{e.subtitle}</span>
                            )}
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
            <button type="button" onClick={prevMonth} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
              <ChevronLeft size={14} />
            </button>
            <div className="pj-cal-month-current">
              {MONTHS[cursor.month]} {cursor.year}
            </div>
            <button type="button" onClick={nextMonth} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
              <ChevronRight size={14} />
            </button>
            <button type="button" onClick={goToday} className="civiq-btn civiq-btn-outline civiq-btn-sm">
              Aujourd&apos;hui
            </button>
          </div>
          <div className="pj-cal-grid">
            {DAYS_SHORT.map((d, i) => (
              <div key={i} className="pj-cal-day-head">{d}</div>
            ))}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`b${i}`} className="pj-cal-day pj-cal-day-blank" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const evs = eventsByDay.get(iso) ?? [];
              return (
                <div
                  key={day}
                  className={`pj-cal-day ${isToday(cursor.year, cursor.month, day) ? "is-today" : ""}`}
                >
                  <span className="pj-cal-day-num">{day}</span>
                  {evs.length > 0 && (
                    <div className="pj-cal-day-events">
                      {evs.slice(0, 3).map((e) => (
                        <Link
                          key={e.id}
                          href={e.href}
                          prefetch={false}
                          className="pj-cal-day-event"
                          style={{ borderLeftColor: e.color }}
                          title={`${e.title}${e.subtitle ? ` — ${e.subtitle}` : ""}`}
                        >
                          <span className="pj-cal-day-event-title">
                            {e.kind === "session" ? "Séance" : e.title}
                          </span>
                          <span className="pj-cal-day-event-sub">
                            {e.kind === "session"
                              ? (e.commissionName ?? e.subtitle)
                              : (e.projectName ?? e.subtitle)}
                          </span>
                        </Link>
                      ))}
                      {evs.length > 3 && (
                        <span className="pj-cal-day-more">+{evs.length - 3}</span>
                      )}
                    </div>
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
