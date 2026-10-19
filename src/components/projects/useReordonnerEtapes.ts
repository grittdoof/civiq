"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

// ═══════════════════════════════════════════════════════════════
// Glisser-déposer des étapes :
//   • appui long (400 ms) n'importe où sur la ligne, à la souris ou au
//     doigt — un déplacement de plus de 8 px avant le délai annule
//     (c'est un défilement, pas un glisser) ;
//   • ou saisie immédiate par la poignée.
// Les éléments de la liste portent data-etape-id. Les flèches haut/bas
// restent disponibles au clavier.
// ═══════════════════════════════════════════════════════════════

const DELAI_MS = 400;
const TOLERANCE_PX = 8;

export interface EtatGlisser { id: string; vers: number }

export function useReordonnerEtapes(opts: {
  actif: boolean;
  ids: string[];
  onDeposer: (id: string, vers: number) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const [glisse, setGlisse] = useState<EtatGlisser | null>(null);
  const glisseRef = useRef<EtatGlisser | null>(null);
  const appui = useRef<{ timer: number; x: number; y: number } | null>(null);
  const nettoyer = useRef<(() => void) | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const maj = (g: EtatGlisser | null) => { glisseRef.current = g; setGlisse(g); };

  /** Position d'insertion (dans la liste sans l'étape déplacée) sous le pointeur. */
  const positionSous = useCallback((y: number, id: string) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-etape-id]") ?? [])
      .filter((el) => el.dataset.etapeId !== id);
    let vers = 0;
    for (const el of items) {
      const r = el.getBoundingClientRect();
      if (y > r.top + r.height / 2) vers += 1;
    }
    return vers;
  }, []);

  const terminer = useCallback((deposer: boolean) => {
    if (appui.current) { window.clearTimeout(appui.current.timer); appui.current = null; }
    nettoyer.current?.();
    nettoyer.current = null;
    const g = glisseRef.current;
    maj(null);
    if (deposer && g) optsRef.current.onDeposer(g.id, g.vers);
  }, []);

  const demarrer = useCallback((id: string, y: number) => {
    appui.current = null;
    navigator.vibrate?.(15);
    maj({ id, vers: positionSous(y, id) });
  }, [positionSous]);

  const onPointerDown = useCallback((e: ReactPointerEvent, id: string, immediat = false) => {
    if (!optsRef.current.actif || e.button !== 0) return;
    const cible = e.target as HTMLElement;
    if (!immediat && cible.closest("button, a, input, select, textarea, label, form")) return;
    terminer(false);
    const depart = { x: e.clientX, y: e.clientY };

    const move = (ev: PointerEvent) => {
      if (glisseRef.current) {
        ev.preventDefault();
        maj({ id, vers: positionSous(ev.clientY, id) });
        return;
      }
      if (appui.current && Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) > TOLERANCE_PX) terminer(false);
    };
    const up = () => terminer(true);
    const cancel = () => terminer(false);
    const key = (ev: KeyboardEvent) => { if (ev.key === "Escape") terminer(false); };
    // Pendant le glisser au doigt, la page ne doit pas défiler.
    const touch = (ev: TouchEvent) => { if (glisseRef.current) ev.preventDefault(); };
    const menu = (ev: Event) => { if (glisseRef.current || appui.current) ev.preventDefault(); };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    window.addEventListener("touchmove", touch, { passive: false });
    window.addEventListener("contextmenu", menu);
    nettoyer.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("touchmove", touch);
      window.removeEventListener("contextmenu", menu);
    };

    if (immediat) { e.preventDefault(); demarrer(id, e.clientY); return; }
    appui.current = { timer: window.setTimeout(() => demarrer(id, depart.y), DELAI_MS), ...depart };
  }, [demarrer, positionSous, terminer]);

  useEffect(() => () => terminer(false), [terminer]);

  /** Classe d'indicateur d'insertion pour l'étape `id` de la liste affichée. */
  const indicateur = (id: string): string => {
    if (!glisse) return "";
    if (id === glisse.id) return " is-dragging";
    const reste = opts.ids.filter((x) => x !== glisse.id);
    if (glisse.vers < reste.length && reste[glisse.vers] === id) return " drop-before";
    if (glisse.vers >= reste.length && reste[reste.length - 1] === id) return " drop-after";
    return "";
  };

  return { listRef, glisse, onPointerDown, indicateur };
}
