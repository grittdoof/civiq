// ═══════════════════════════════════════════════════════════════
// Envoi d'une étape par email à un tiers (secrétariat, prestataire,
// agent…) — logique pure. Le message est prérédigé pour un envoi en
// un clic, et reste modifiable avant l'envoi.
//
// Jamais de note interne : ni commentaire « note interne », ni pièce
// marquée « note interne ».
// ═══════════════════════════════════════════════════════════════

export const MAX_DESTINATAIRES = 10;
export const MAX_PIECES_OCTETS = 20 * 1024 * 1024;

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;

export interface EtapeAEnvoyer {
  libelle: string;
  date_previsionnelle: string | null;
  statutLibelle: string;
  commentaire: string | null;
  commentaire_note_interne?: boolean | null;
}

export interface ContactUtile {
  nom: string;
  organisation?: string | null;
  email?: string | null;
  telephone?: string | null;
}

export interface MessageEtapeInput {
  projet: { titre: string; commission?: string | null };
  etape: EtapeAEnvoyer;
  contacts: ContactUtile[];
  pieces: string[];
  expediteur: { nom: string | null; fonction?: string | null };
  commune: string;
}

/** Date murale (composantes UTC) : « 12 juin 2026 » ou « 12 juin 2026 à 14 h 30 ». */
export function dateEtape(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const jour = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return h === 0 && m === 0 ? jour : `${jour} à ${h} h ${String(m).padStart(2, "0")}`;
}

export function messageEtape(i: MessageEtapeInput): { objet: string; message: string } {
  const objet = `${i.projet.titre} — ${i.etape.libelle}`.slice(0, 200);
  const lignes: string[] = [];
  lignes.push(`Étape : ${i.etape.libelle}`);
  const date = dateEtape(i.etape.date_previsionnelle);
  if (date) lignes.push(`Échéance : ${date}`);
  lignes.push(`Statut : ${i.etape.statutLibelle}`);
  if (i.etape.commentaire && !i.etape.commentaire_note_interne) lignes.push(`Précisions : ${i.etape.commentaire.trim()}`);
  const contacts = i.contacts.map((c) =>
    [c.nom, c.organisation ? `(${c.organisation})` : null, c.email, c.telephone].filter(Boolean).join(" · "),
  );
  if (contacts.length) lignes.push(`Contacts utiles :\n${contacts.map((c) => `  - ${c}`).join("\n")}`);
  if (i.pieces.length) lignes.push(`Pièces jointes : ${i.pieces.join(", ")}`);

  const signature = [i.expediteur.nom, i.expediteur.fonction].filter(Boolean).join(", ");
  const message = [
    "Bonjour,",
    "",
    `Dans le cadre du projet « ${i.projet.titre} »${i.projet.commission ? ` (commission ${i.projet.commission})` : ""}, je vous confie l'étape suivante :`,
    "",
    ...lignes.map((l) => `• ${l}`),
    "",
    "Merci de me tenir informé(e) de son avancement en répondant à ce message.",
    "",
    "Cordialement,",
    signature || "",
    `Mairie de ${i.commune}`,
  ].filter((l, k, a) => !(l === "" && a[k - 1] === "")).join("\n");
  return { objet, message: message.trimEnd() };
}

/** Adresses normalisées, dédoublonnées ; les invalides sont renvoyées à part. */
export function validerDestinataires(liste: unknown): { valides: string[]; invalides: string[] } {
  const brutes = Array.isArray(liste) ? liste : [];
  const valides: string[] = [];
  const invalides: string[] = [];
  for (const b of brutes) {
    const e = typeof b === "string" ? b.trim().toLowerCase() : "";
    if (!e) continue;
    if (!EMAIL_RE.test(e) || e.length > 254) invalides.push(String(b));
    else if (!valides.includes(e)) valides.push(e);
  }
  return { valides, invalides };
}

/** Corps HTML (paragraphes, retours à la ligne) d'un message saisi en texte brut. */
export function messageVersHtml(
  message: string,
  esc: (s: string) => string,
  paragraph: (html: string) => string,
): string {
  return message
    .trim()
    .split(/\n{2,}/)
    .map((bloc) => paragraph(esc(bloc).replace(/\n/g, "<br>")))
    .join("\n");
}
