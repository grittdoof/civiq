// ═══════════════════════════════════════════════════════════════
// Texte riche (ordre du jour, compte rendu) — helpers purs.
//
// Le HTML stocké est déjà passé par sanitizeRichText : balises de la
// liste blanche, SANS attributs (p, br, strong/b, em/i, u, h1-h4,
// ul/ol/li). On le convertit ici en blocs structurés pour le PDF
// (@react-pdf ne rend pas le HTML).
//
// Rétro-compatibilité : les comptes rendus rédigés avant la mise en
// forme sont du texte brut → plainTextToHtml.
// ═══════════════════════════════════════════════════════════════

export interface RichRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface RichBlock {
  type: "h2" | "h3" | "p" | "li";
  /** Pour li : liste numérotée ? */
  ordered?: boolean;
  /** Pour li numéroté : position (1-based) */
  index?: number;
  /**
   * Pour li : marqueur à afficher (« 1. », « • ») ou null quand la liste
   * porte déjà des numéros / tirets saisis à la main (texte collé d'un
   * courriel : une ligne = un élément). Même règle qu'à l'écran.
   */
  marker?: string | null;
  /** Identifiant de la liste d'appartenance (interne au calcul des marqueurs). */
  listId?: number;
  runs: RichRun[];
}

/** « 1. », « 2) », « a. », « - », « + », « • »… saisis en début d'élément. */
export const MARQUEUR_MANUEL = /^\s*(?:\d{1,3}[.)]|[a-zA-Z][.)]|[-–—+•·*▪◦])\s/;

/**
 * Listes dont un élément commence par un marqueur saisi à la main :
 * classe `pj-rich-manuel` (pas de numéro ni de puce automatique).
 * À appliquer sur du HTML déjà assaini (toRichHtml).
 */
export function marquerListesManuelles(html: string): string {
  return html.replace(/<(ol|ul)>([\s\S]*?)<\/\1>/g, (m, tag: string, inner: string) => {
    const items = [...inner.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " "));
    return items.some((t) => MARQUEUR_MANUEL.test(t)) ? `<${tag} class="pj-rich-manuel">${inner}</${tag}>` : m;
  });
}

const RICH_TAG = /<\/?(p|br|strong|b|em|i|u|h[1-4]|ul|ol|li)\b[^>]*>/i;

export function isRichHtml(value: string | null | undefined): boolean {
  return Boolean(value && RICH_TAG.test(value));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texte brut → HTML (paragraphes sur ligne vide, <br> sinon). */
export function plainTextToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Normalise une valeur stockée (HTML ou texte brut legacy) en HTML. */
export function toRichHtml(value: string | null | undefined): string {
  if (!value) return "";
  // Ré-assainit à la lecture : défense en profondeur pour les contenus
  // enregistrés avant le durcissement de sanitizeRichText.
  // Listes aux numéros saisis à la main : pas de marqueur automatique
  // (même règle dans le PDF, cf. parseRichText).
  return isRichHtml(value) ? marquerListesManuelles(sanitizeRichText(value)) : plainTextToHtml(value);
}

// ─── Sanitization ───
// Stratégie « tout échapper puis ré-autoriser » : seules les balises
// de la liste blanche, réécrites SANS attributs (style/class collés
// depuis Word, handlers on*, href…), redeviennent du HTML. Tout autre
// « < » ou « > » est échappé → aucune balise inconnue, aucun attribut,
// même mal formé (<img/src=x onerror=…>, guillemets absents, etc.).
const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u",
  "h1", "h2", "h3", "h4", "ul", "ol", "li",
]);

// Balise candidate : nom immédiatement suivi d'un séparateur ou de « > ».
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)(?=[\s/>])[^<>]*>/g;

function escapeText(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sanitizeRichText(html: string): string {
  if (!html) return "";
  // Le contenu de ces éléments n'est jamais du texte à conserver.
  const stripped = html
    .replace(/<(script|style|iframe|object|template|noscript|textarea|title)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  let out = "";
  let last = 0;
  for (const m of stripped.matchAll(TAG_RE)) {
    const idx = m.index ?? 0;
    out += escapeText(stripped.slice(last, idx));
    const tag = m[2].toLowerCase();
    if (ALLOWED_TAGS.has(tag)) out += tag === "br" ? "<br>" : `<${m[1]}${tag}>`;
    // balise hors liste blanche : supprimée (son contenu texte reste)
    last = idx + m[0].length;
  }
  out += escapeText(stripped.slice(last));
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

/** HTML assaini (ou texte brut) → blocs pour le rendu PDF. */
export function parseRichText(value: string | null | undefined): RichBlock[] {
  const html = toRichHtml(value);
  const blocks: RichBlock[] = [];
  const style = { bold: 0, italic: 0, underline: 0 };
  const lists: { ordered: boolean; count: number; id: number }[] = [];
  let nextListId = 0;
  let current: RichBlock | null = null;

  const ensureBlock = (): RichBlock => {
    if (!current) {
      current = { type: "p", runs: [] };
      blocks.push(current);
    }
    return current;
  };
  const closeBlock = () => {
    current = null;
  };
  const openBlock = (block: RichBlock) => {
    current = block;
    blocks.push(block);
  };

  const tokens = html.split(/(<[^>]+>)/g);
  for (const token of tokens) {
    if (!token) continue;
    const tag = /^<(\/?)([a-z0-9]+)/i.exec(token);
    if (!tag) {
      const text = decodeEntities(token.replace(/\s+/g, " "));
      if (!text.trim() && !current) continue;
      ensureBlock().runs.push({
        text,
        bold: style.bold > 0,
        italic: style.italic > 0,
        underline: style.underline > 0,
      });
      continue;
    }
    const closing = tag[1] === "/";
    const name = tag[2].toLowerCase();
    switch (name) {
      case "strong":
      case "b":
        style.bold += closing ? -1 : 1;
        break;
      case "em":
      case "i":
        style.italic += closing ? -1 : 1;
        break;
      case "u":
        style.underline += closing ? -1 : 1;
        break;
      case "br":
        // Dans un élément de liste : retour à la ligne. Ailleurs : nouveau
        // paragraphe (un saut de ligne entre deux polices — italique puis
        // gras — faisait disparaître le texte italique dans react-pdf).
        if (current && (current as RichBlock).type === "li") {
          ensureBlock().runs.push({ text: "\n", bold: false, italic: false, underline: false });
        } else {
          closeBlock();
        }
        break;
      case "h1":
      case "h2":
        if (closing) closeBlock();
        else openBlock({ type: "h2", runs: [] });
        break;
      case "h3":
      case "h4":
        if (closing) closeBlock();
        else openBlock({ type: "h3", runs: [] });
        break;
      case "p":
        // Un <p> dans un <li> (collage) ne doit pas casser l'item
        if (closing) {
          if (current && (current as RichBlock).type !== "li") closeBlock();
        } else if (!current || (current as RichBlock).type !== "li") {
          openBlock({ type: "p", runs: [] });
        }
        break;
      case "ul":
      case "ol":
        closeBlock();
        if (closing) lists.pop();
        else lists.push({ ordered: name === "ol", count: 0, id: ++nextListId });
        break;
      case "li": {
        if (closing) {
          closeBlock();
          break;
        }
        const list = lists[lists.length - 1] ?? { ordered: false, count: 0, id: 0 };
        list.count += 1;
        openBlock({ type: "li", ordered: list.ordered, index: list.count, listId: list.id, runs: [] });
        break;
      }
      default:
        break;
    }
    // Garde-fous contre du HTML mal balisé
    style.bold = Math.max(0, style.bold);
    style.italic = Math.max(0, style.italic);
    style.underline = Math.max(0, style.underline);
  }

  // Nettoyage : trim des bords de bloc, suppression des blocs vides
  const nettoyes = blocks
    .map((b) => {
      const runs = b.runs.filter((r) => r.text.length > 0);
      if (runs.length) {
        runs[0] = { ...runs[0], text: runs[0].text.replace(/^[ ]+/, "") };
        const last = runs.length - 1;
        runs[last] = { ...runs[last], text: runs[last].text.replace(/[ \n]+$/, "") };
      }
      return { ...b, runs: runs.filter((r) => r.text.length > 0) };
    })
    .filter((b) => b.runs.length > 0);

  // Marqueurs : aucun automatique si la liste en porte déjà à la main.
  const manuelles = new Set<number>();
  for (const b of nettoyes) {
    if (b.type === "li" && MARQUEUR_MANUEL.test(b.runs.map((r) => r.text).join(""))) manuelles.add(b.listId ?? 0);
  }
  return nettoyes.map((b) =>
    b.type === "li"
      ? { ...b, marker: manuelles.has(b.listId ?? 0) ? null : b.ordered ? `${b.index}.` : "•" }
      : b,
  );
}
