// Lien d'abonnement iCal personnel (serveur).
import { randomBytes } from "crypto";
import { getSiteUrl } from "@/lib/email";

/** Jeton aléatoire de 192 bits, sans lien avec l'identité de l'utilisateur. */
export function genererJetonFlux(): string {
  return randomBytes(24).toString("base64url");
}

export function urlFlux(token: string, site = getSiteUrl()): string {
  return `${site}/api/agenda/${token}.ics`;
}

export function lirePerimetre(v: unknown): "tout" | "mes" | null {
  return v === "tout" || v === "mes" ? v : null;
}
