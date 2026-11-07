// ═══════════════════════════════════════════════════════════════
// Pièces jointes des signalements — logique pure (lot 6).
//
// Les photos (bucket `tickets-photos`) et les documents du rapport
// de clôture (bucket `tickets-documents`) sont privés. Le navigateur
// ne reçoit jamais de lien signé dans la page : il pointe vers une
// adresse stable de notre domaine, qui vérifie les droits au moment
// de l'ouverture puis redirige vers un lien signé de courte durée.
//   /api/tickets/<ticket>/photos/<photo>[?taille=miniature|&telecharger=1]
//   /api/tickets/<ticket>/documents/<nom du fichier>[?telecharger=1]
// Un lien ne périme donc jamais dans une page restée ouverte (PWA).
// ═══════════════════════════════════════════════════════════════

/** Durée des liens signés vers le stockage (secondes). */
export const DUREE_LIEN_SIGNE = 10 * 60;
/** Durée pendant laquelle le navigateur réutilise la redirection (secondes). */
export const CACHE_REDIRECTION = 5 * 60;

/** Dossier des miniatures, sous le dossier de la commune. */
export const DOSSIER_MINIATURES = "miniatures";
/** Côté le plus long d'une miniature (px). */
export const MINIATURE_PX = 480;

export type GenrePiece = "image" | "pdf" | "fichier";

const EXT_IMAGES = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic"]);

function extension(nom: string): string {
  return (nom.match(/\.([a-z0-9]{1,8})$/i)?.[1] ?? "").toLowerCase();
}

/** Image, PDF ou autre fichier (Word, Excel…), d'après le nom. */
export function genrePiece(nom: string): GenrePiece {
  const ext = extension(nom);
  if (EXT_IMAGES.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "fichier";
}

/**
 * Un navigateur sait afficher une image ou un PDF dans un onglet ;
 * les autres formats sont téléchargés.
 */
export function ouvrirDansNavigateur(nom: string): boolean {
  return genrePiece(nom) !== "fichier";
}

/** `<commune>/<uuid>.jpg` → `<commune>/miniatures/<uuid>.jpg` (null si chemin inattendu). */
export function cheminMiniature(cheminPhoto: string): string | null {
  const morceaux = cheminPhoto.split("/");
  if (morceaux.length !== 2 || !morceaux[0] || !morceaux[1]) return null;
  return `${morceaux[0]}/${DOSSIER_MINIATURES}/${morceaux[1]}`;
}

/** Adresse stable d'une photo de signalement. */
export function urlPhoto(ticketId: string, photoId: string, opts: { miniature?: boolean; telecharger?: boolean } = {}): string {
  const params = new URLSearchParams();
  if (opts.miniature) params.set("taille", "miniature");
  if (opts.telecharger) params.set("telecharger", "1");
  const q = params.toString();
  return `/api/tickets/${encodeURIComponent(ticketId)}/photos/${encodeURIComponent(photoId)}${q ? `?${q}` : ""}`;
}

/** Dernier segment d'un chemin de stockage. */
export function nomFichier(chemin: string): string {
  return chemin.split("/").pop() ?? "";
}

/** Adresse stable d'un document du rapport de clôture. */
export function urlDocument(ticketId: string, chemin: string, opts: { telecharger?: boolean } = {}): string {
  const q = opts.telecharger ? "?telecharger=1" : "";
  return `/api/tickets/${encodeURIComponent(ticketId)}/documents/${encodeURIComponent(nomFichier(chemin))}${q}`;
}

/**
 * Retrouve, parmi les documents enregistrés sur le rapport, celui
 * dont le nom de fichier est demandé. Le nom seul ne suffit jamais :
 * il doit figurer dans la liste du rapport ET passer `valide` (préfixe
 * de la commune du signalement).
 */
export function trouverDocument(
  chemins: string[] | null | undefined,
  nom: string,
  valide: (chemin: string) => boolean,
): string | null {
  if (!nom || nom.includes("/") || nom.includes("..")) return null;
  return (chemins ?? []).find((c) => nomFichier(c) === nom && valide(c)) ?? null;
}

/** Vrai si la requête demande un téléchargement plutôt qu'un affichage. */
export function demandeTelechargement(params: URLSearchParams): boolean {
  return params.get("telecharger") === "1";
}
