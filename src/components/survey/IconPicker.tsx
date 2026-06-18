"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import {
  ICON_LIBRARY,
  ICON_BY_NAME,
  EMOJI_TO_ICON_NAME,
} from "./icon-library";

interface IconPickerProps {
  value?: string;
  onChange: (name: string | undefined) => void;
  className?: string;
}

// Résout la valeur stockée (nom Lucide OU emoji legacy) vers le composant
export function resolveIcon(value: string | undefined) {
  if (!value) return null;
  if (ICON_BY_NAME[value]) return ICON_BY_NAME[value];
  const mapped = EMOJI_TO_ICON_NAME[value];
  if (mapped && ICON_BY_NAME[mapped]) return ICON_BY_NAME[mapped];
  return null;
}

export default function IconPicker({
  value,
  onChange,
  className,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    // Focus la recherche après ouverture
    setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_LIBRARY;
    return ICON_LIBRARY.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.label.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [query]);

  const Current = resolveIcon(value);
  const resolvedName =
    value && ICON_BY_NAME[value]
      ? value
      : (value && EMOJI_TO_ICON_NAME[value]) || null;

  return (
    <div
      ref={wrapperRef}
      className={`sb-icon-picker${className ? " " + className : ""}`}
    >
      <button
        type="button"
        className="sb-icon-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        title="Choisir une icône"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {Current ? <Current size={16} /> : <span className="sb-icon-picker-empty">—</span>}
        <ChevronDown size={12} className="sb-icon-picker-caret" />
      </button>

      {open && (
        <div
          className="sb-icon-picker-popover"
          role="dialog"
          aria-label="Bibliothèque d'icônes"
        >
          <div className="sb-icon-picker-search">
            <Search size={14} aria-hidden />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une icône…"
              className="sb-icon-picker-input"
            />
            {value && (
              <button
                type="button"
                className="sb-icon-picker-clear"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                title="Retirer l'icône"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="sb-icon-picker-grid">
            {filtered.length === 0 ? (
              <div className="sb-icon-picker-empty-state">
                Aucune icône trouvée.
              </div>
            ) : (
              filtered.map(({ name, component: Icon, label }) => (
                <button
                  key={name}
                  type="button"
                  className={`sb-icon-picker-item${
                    resolvedName === name ? " selected" : ""
                  }`}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  title={label}
                  aria-label={label}
                >
                  <Icon size={18} />
                </button>
              ))
            )}
          </div>

          <div className="sb-icon-picker-footer">
            {filtered.length} icône{filtered.length > 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
