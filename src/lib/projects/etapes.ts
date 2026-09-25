// ═══════════════════════════════════════════════════════════════
// Étapes d'un projet (brief §2.4, §2.6) — logique pure.
//
// Statut : couleur + icône + libellé (RGAA 3.1 : jamais la couleur seule).
// Fonds repris de la palette de statuts du module Tickets
// (STATUT_COLORS nouveau / en_cours / resolu). Le texte reste foncé
// (--fg) : l'orange #F59E0B des tickets sur fond ambre est à ~2:1,
// sous le seuil de 4,5:1.
// ═══════════════════════════════════════════════════════════════

import { STATUT_COLORS } from "@/lib/tickets/types";
import type { EtapeStatut, Milestone } from "./types";

export const ETAPE_STATUTS: EtapeStatut[] = ["a_faire", "en_cours", "termine"];

export const ETAPE_STATUT_META: Record<EtapeStatut, { label: string; icon: "Circle" | "CircleDot" | "CheckCircle2"; bg: string }> = {
  a_faire: { label: "À faire", icon: "Circle", bg: STATUT_COLORS.nouveau.bg },
  en_cours: { label: "En cours", icon: "CircleDot", bg: STATUT_COLORS.en_cours.bg },
  termine: { label: "Terminé", icon: "CheckCircle2", bg: STATUT_COLORS.resolu.bg },
};

export function nextStatut(s: EtapeStatut): EtapeStatut {
  return ETAPE_STATUTS[(ETAPE_STATUTS.indexOf(s) + 1) % ETAPE_STATUTS.length];
}

type EtapeLike = Pick<Milestone, "statut" | "date_previsionnelle" | "fait" | "echeance"> & {
  ordre?: number | null;
  created_at?: string;
};

export function statutOf(e: EtapeLike): EtapeStatut {
  return e.statut ?? (e.fait ? "termine" : "a_faire");
}

export function datePrevue(e: EtapeLike): string | null {
  return e.date_previsionnelle ?? (e.echeance ? `${e.echeance}T00:00:00.000Z` : null);
}

/** En retard : date prévisionnelle dépassée (jour échu) et étape non terminée. */
export function isEnRetard(e: EtapeLike, now: Date = new Date()): boolean {
  if (statutOf(e) === "termine") return false;
  const d = datePrevue(e);
  if (!d) return false;
  // Heure murale en composantes UTC : on compare les jours calendaires.
  return d.slice(0, 10) < now.toISOString().slice(0, 10);
}

/** Ordre de la liste des étapes : ordre saisi, puis date, puis création. */
export function sortEtapes<T extends EtapeLike>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const oa = a.ordre ?? Number.MAX_SAFE_INTEGER;
    const ob = b.ordre ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    const da = datePrevue(a) ?? "9999";
    const db = datePrevue(b) ?? "9999";
    if (da !== db) return da < db ? -1 : 1;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

/** Rétroplanning (événement) : étapes en retard en tête, puis par date. */
export function sortRetroplanning<T extends EtapeLike>(list: T[], now: Date = new Date()): T[] {
  return [...list].sort((a, b) => {
    const la = isEnRetard(a, now) ? 0 : 1;
    const lb = isEnRetard(b, now) ? 0 : 1;
    if (la !== lb) return la - lb;
    const da = datePrevue(a) ?? "9999";
    const db = datePrevue(b) ?? "9999";
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

/** Compte à rebours : jours calendaires jusqu'à l'événement (négatif = passé). */
export function joursAvant(evenementIso: string, now: Date = new Date()): number {
  const target = Date.parse(`${evenementIso.slice(0, 10)}T00:00:00.000Z`);
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

export function libelleCompteARebours(jours: number): string {
  if (jours === 0) return "C'est aujourd'hui";
  if (jours > 0) return `J-${jours}`;
  return `Passé de ${-jours} jour${jours === -1 ? "" : "s"}`;
}

/** Avancement affiché : surcharge manuelle prioritaire, sinon calcul par jalons. */
export function avancementAffiche(p: {
  avancement_pct?: number | null;
  avancement_manuel_pct?: number | null;
}): { pct: number | null; manuel: boolean } {
  if (p.avancement_manuel_pct !== null && p.avancement_manuel_pct !== undefined) {
    return { pct: Number(p.avancement_manuel_pct), manuel: true };
  }
  if (p.avancement_pct === null || p.avancement_pct === undefined) return { pct: null, manuel: false };
  return { pct: Number(p.avancement_pct), manuel: false };
}

/** Formatage d'une date d'étape (composantes UTC = heure murale). */
export function formatEtapeDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hasTime = !iso.includes("T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

// ─── Validation des champs d'étape (API POST / PATCH) ───
const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

export type EtapeFields = Partial<{
  libelle: string;
  statut: EtapeStatut;
  date_previsionnelle: string | null;
  date_reelle: string | null;
  est_un_jalon: boolean;
  remonter_au_reporting: boolean;
  commentaire: string | null;
  commentaire_note_interne: boolean;
  ordre: number;
  responsable_user_id: string | null;
}>;

function toIso(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !ISO_RE.test(v)) return undefined;
  // Date seule → minuit en composantes UTC (heure murale, convention Session 16).
  return v.length === 10 ? `${v}T00:00:00.000Z` : v;
}

export function parseEtapeFields(body: Record<string, unknown>): { ok: true; fields: EtapeFields } | { ok: false; error: string } {
  const f: EtapeFields = {};
  if ("libelle" in body) {
    const t = typeof body.libelle === "string" ? body.libelle.trim() : "";
    if (!t) return { ok: false, error: "Le libellé est obligatoire." };
    if (t.length > 300) return { ok: false, error: "300 caractères au maximum." };
    f.libelle = t;
  }
  if ("statut" in body) {
    if (!ETAPE_STATUTS.includes(body.statut as EtapeStatut)) return { ok: false, error: "Statut inconnu." };
    f.statut = body.statut as EtapeStatut;
  }
  for (const k of ["date_previsionnelle", "date_reelle"] as const) {
    if (!(k in body)) continue;
    const v = toIso(body[k]);
    if (v === undefined) return { ok: false, error: "Date invalide." };
    f[k] = v;
  }
  for (const k of ["est_un_jalon", "remonter_au_reporting", "commentaire_note_interne"] as const) {
    if (k in body) f[k] = body[k] === true;
  }
  if ("commentaire" in body) {
    const c = typeof body.commentaire === "string" ? body.commentaire.trim() : "";
    f.commentaire = c ? c.slice(0, 5000) : null;
  }
  if ("ordre" in body) {
    const n = Number(body.ordre);
    if (!Number.isInteger(n)) return { ok: false, error: "Ordre invalide." };
    f.ordre = n;
  }
  if ("responsable_user_id" in body) {
    f.responsable_user_id = typeof body.responsable_user_id === "string" && body.responsable_user_id ? body.responsable_user_id : null;
  }
  return { ok: true, fields: f };
}
