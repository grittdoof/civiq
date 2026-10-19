// Lien d'abonnement iCal personnel (serveur).
import { randomBytes } from "crypto";
import { getSiteUrl } from "@/lib/email";

/** Jeton aléatoire de 192 bits, sans lien avec l'identité de l'utilisateur. */
export function genererJetonFlux(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Adresse du flux. Avec `slug`, elle se termine par un nom lisible
 * (…/agenda/<jeton>/gociviq-chateauneuf.ics) : certains agendas nomment
 * l'abonnement d'après l'adresse. L'ancienne forme reste valable.
 */
export function urlFlux(token: string, slug?: string | null, site = getSiteUrl()): string {
  return slug ? `${site}/api/agenda/${token}/${slug}.ics` : `${site}/api/agenda/${token}.ics`;
}

export function lirePerimetre(v: unknown): "tout" | "mes" | null {
  return v === "tout" || v === "mes" ? v : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Commissions choisies : liste d'identifiants, ou null (= toutes). `undefined` = non fourni. */
export function lireCommissions(v: unknown): string[] | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || !Array.isArray(v)) return null;
  const ids = [...new Set(v.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)))].slice(0, 50);
  return ids.length ? ids : null;
}
