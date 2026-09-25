"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Heading2, Heading3, Pilcrow, Undo, Redo } from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
}

// ═══════════════════════════════════════════════════════════════
// RichTextEditor — éditeur contenteditable simple avec barre
// d'outils (gras / italique / souligné / titre / sous-titre / texte
// normal / liste à puces / liste numérotée / annuler / refaire).
//
// Stocke et restitue du HTML. La sanitization de sécurité est
// faite côté serveur lors de l'enregistrement (sanitizeHtml ci-
// dessous). Pour un MVP on accepte un sous-ensemble très limité
// de balises ; aucune injection de script possible côté affichage
// car on rend toujours le HTML via dangerouslySetInnerHTML après
// passage par sanitize.
// ═══════════════════════════════════════════════════════════════

export default function RichTextEditor({ value, onChange, placeholder, rows = 6 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // Synchronise valeur entrante (sans casser le caret pendant l'édition)
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  function exec(cmd: string, arg?: string) {
    // Balises sémantiques (<b>, <i>, <u>) plutôt que des <span style>
    // que la sanitization serveur retirerait.
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
    ref.current?.focus();
  }

  function handleInput() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  const showPlaceholder = !value || value === "<br>" || value.trim() === "";

  return (
    <div className={`pj-rte ${focused ? "is-focused" : ""}`}>
      <div className="pj-rte-toolbar" aria-label="Mise en forme">
        <ToolbarBtn onClick={() => exec("bold")} title="Gras (Ctrl+B)"><Bold size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("italic")} title="Italique (Ctrl+I)"><Italic size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("underline")} title="Souligné (Ctrl+U)"><Underline size={14} /></ToolbarBtn>
        <span className="pj-rte-sep" />
        <ToolbarBtn onClick={() => exec("formatBlock", "<h2>")} title="Titre"><Heading2 size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("formatBlock", "<h3>")} title="Sous-titre"><Heading3 size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("formatBlock", "<p>")} title="Texte normal"><Pilcrow size={14} /></ToolbarBtn>
        <span className="pj-rte-sep" />
        <ToolbarBtn onClick={() => exec("insertUnorderedList")} title="Liste à puces"><List size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("insertOrderedList")} title="Liste numérotée"><ListOrdered size={14} /></ToolbarBtn>
        <span className="pj-rte-sep" />
        <ToolbarBtn onClick={() => exec("undo")} title="Annuler (Ctrl+Z)"><Undo size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("redo")} title="Refaire (Ctrl+Y)"><Redo size={14} /></ToolbarBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="pj-rte-area"
        style={{ minHeight: rows * 22 }}
        onInput={handleInput}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        data-placeholder={placeholder ?? ""}
      />
      {showPlaceholder && placeholder && (
        <div className="pj-rte-placeholder">{placeholder}</div>
      )}
    </div>
  );
}

function ToolbarBtn({
  onClick, title, children,
}: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      // mousedown : on évite que le bouton vole le focus du contenteditable
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      aria-label={title}
      className="pj-rte-btn"
    >
      {children}
    </button>
  );
}

// ─── Sanitization ───
// Implémentation pure dans lib/projects/rich-text (utilisable côté
// serveur : route handlers, pages, emails). Ré-export pour compat.
export { sanitizeRichText } from "@/lib/projects/rich-text";
