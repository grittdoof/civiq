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

// ─── Sanitization serveur ───
// Liste blanche très restrictive : pas de scripts ni d'attributs
// d'événements ; juste mise en forme texte basique.
const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u",
  "h1", "h2", "h3", "h4", "ul", "ol", "li",
]);

export function sanitizeRichText(html: string): string {
  if (!html) return "";
  // Suppression des balises script/style/iframe
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    // Attributs on*= (handlers d'événements) supprimés
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "")
    // javascript: dans href / src
    .replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, "$1=\"#\"")
    .replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'");

  // Filtrage des balises hors whitelist (laisse le contenu textuel)
  // Les balises autorisées sont réécrites SANS attributs (style, class
  // collés depuis Word/Google Docs) : rendu homogène écran / email / PDF.
  cleaned = cleaned.replace(/<(\/?)([a-z0-9]+)(\s[^>]*)?>/gi, (_match, slash, tag) => {
    const t = tag.toLowerCase();
    return ALLOWED_TAGS.has(t) ? `<${slash}${t}>` : "";
  });

  return cleaned;
}
