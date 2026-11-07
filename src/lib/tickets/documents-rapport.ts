// ═══════════════════════════════════════════════════════════════
// Pièces jointes du rapport d'intervention (clôture d'un signalement)
//
// Bucket privé « tickets-documents » (migration 055) : aucune policy,
// lecture et écriture par le service role uniquement (liens de dépôt
// et de lecture signés). Chemin choisi par le serveur :
//   tickets/<communeId>/rapports/<uuid>_<nom-ascii>.<ext>
// Le nom d'origine (simplifié) est gardé dans le chemin : la colonne
// ticket_rapports.document_paths n'enregistre que des chemins.
// Logique pure : testée dans tests/unit/tickets/documents-rapport.test.ts
// ═══════════════════════════════════════════════════════════════

export const BUCKET_DOCUMENTS_RAPPORT = "tickets-documents";

export const MAX_DOCUMENT_RAPPORT_OCTETS = 20 * 1024 * 1024;

/** Type MIME imposé d'après l'extension (jamais celui du navigateur). */
export const MIME_DOCUMENT_RAPPORT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  txt: "text/plain",
};

export const ACCEPT_DOCUMENT_RAPPORT = Object.keys(MIME_DOCUMENT_RAPPORT).map((e) => `.${e}`).join(",");

export function prefixeRapports(communeId: string): string {
  return `tickets/${communeId}/rapports/`;
}

function extension(nom: string): string {
  return (nom.match(/\.([a-z0-9]{1,8})$/i)?.[1] ?? "").toLowerCase();
}

/** Type MIME d'un nom de fichier, ou null si le format n'est pas accepté. */
export function mimeDocumentRapport(nom: string): string | null {
  return MIME_DOCUMENT_RAPPORT[extension(nom)] ?? null;
}

/** Nom d'origine réduit à des caractères sûrs pour un chemin de stockage. */
export function nomAscii(nom: string): string {
  const base = nom.replace(/\.[a-z0-9]{1,8}$/i, "");
  const simple = base
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return simple || "document";
}

/** Chemin de dépôt choisi par le serveur (null si format refusé). */
export function cheminDocumentRapport(communeId: string, nom: string, uuid: string): string | null {
  const ext = extension(nom);
  if (!MIME_DOCUMENT_RAPPORT[ext]) return null;
  return `${prefixeRapports(communeId)}${uuid}_${nomAscii(nom)}.${ext}`;
}

/** Nom lisible d'une pièce : « Facture-plombier.pdf ». */
export function nomAffichable(path: string): string {
  const fichier = path.split("/").pop() ?? path;
  const m = fichier.match(/^[0-9a-f-]{36}_(.+)$/i);
  return m ? m[1] : fichier;
}

/** Chemin bien formé, sous le préfixe de la commune, sans sous-dossier. */
export function estCheminRapportValide(path: unknown, communeId: string): path is string {
  if (typeof path !== "string") return false;
  const prefixe = prefixeRapports(communeId);
  if (!path.startsWith(prefixe) || path.includes("..")) return false;
  const reste = path.slice(prefixe.length);
  return reste.length > 0 && !reste.includes("/") && mimeDocumentRapport(reste) !== null;
}
