"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, List, ChevronLeft, ChevronRight, Flag, Gavel, Wallet } from "lucide-react";
import type { CalendarEvent } from "@/lib/projects/calendar-queries";

interface Props {
  events: CalendarEvent[];
}

// ═══════════════════════════════════════════════════════════════
// Vue calendrier — bascule liste chronologique / vue mensuelle.
// ═══════════════════════════════════════════════════════════════

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

function eventIcon(kind: CalendarEvent["kind"]) {
  switch (kind) {
    case "milestone": return <Flag size={14} />;
    case "session": return <Gavel size={14} />;
    case "financing_ar_pending": return <Wallet size={14} />;
  }
}

function eventColor(kind: CalendarEvent["kind"]): string {
  switch (kind) {
    case "milestone": return "var(--civiq-primary)";
    case "session": return "var(--accent)";
    case "financing_ar_pending": return "var(--civiq-warning)";
  }
}

export default function CalendarView({ events }: Props) {
  const [mode, setMode] = useState<"list" | "month">("list");
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

  // Group events par jour pour la vue mois
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const day = e.date.slice(0, 10);
    const arr = eventsByDay.get(day) ?? [];
    arr.push(e);
    eventsByDay.set(day, arr);
  }

  // Group events par mois pour la vue liste
  const eventsByMonth = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const ym = e.date.slice(0, 7);
    const arr = eventsByMonth.get(ym) ?? [];
    arr.push(e);
    eventsByMonth.set(ym, arr);
  }

  // ─── Construction de la grille du mois ───
  const firstDay = new Date(cursor.year, cursor.month, 1);
  const lastDay = new Date(cursor.year, cursor.month + 1, 0);
  // Décalage début : 0 (lundi) à 6 (dimanche)
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  const isToday = (y: number, m: number, d: number) =>
    today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  return (
    <>
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

      {mode === "list" && (
        <div className="pj-cal-list">
          {events.length === 0 ? (
            <p className="pj-section-empty">Aucune date clé à venir.</p>
          ) : (
            [...eventsByMonth.entries()].map(([ym, evs]) => {
              const [y, m] = ym.split("-").map(Number);
              return (
                <div key={ym} className="pj-cal-month-block">
                  <h3 className="pj-cal-month-title">
                    {MONTHS[m - 1]} {y}
                  </h3>
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
                            className="pj-cal-event-icon"
                            style={{ color: eventColor(e.kind) }}
                          >
                            {eventIcon(e.kind)}
                          </span>
                          <span>
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
                    <div className="pj-cal-day-dots">
                      {evs.slice(0, 4).map((e) => (
                        <Link
                          key={e.id}
                          href={e.href}
                          title={e.title}
                          prefetch={false}
                          className="pj-cal-day-dot"
                          style={{ background: eventColor(e.kind) }}
                        />
                      ))}
                      {evs.length > 4 && (
                        <span className="pj-cal-day-more">+{evs.length - 4}</span>
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
