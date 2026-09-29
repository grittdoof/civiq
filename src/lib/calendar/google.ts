// ═══════════════════════════════════════════════════════════════
// Synchronisation Google Agenda (serveur uniquement) — lot E.
//
// • Portée minimale « calendar.app.created » : GoCiviq crée son propre
//   agenda secondaire « GoCiviq — <commune> » et ne peut ni lire ni
//   modifier les autres agendas de l'élu.
// • Sens unique : GoCiviq → Google. Une modification faite dans Google
//   est écrasée à la synchronisation suivante.
// • Secrets : GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (console Google
//   Cloud) et GOOGLE_TOKEN_KEY (chiffrement des jetons en base). Sans
//   ces variables, la fonction est simplement masquée.
// • Déclenchement : après chaque modification (next/server `after`) et
//   une fois par jour par tâche planifiée (filet de sécurité).
// ═══════════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/email";
import { dansFenetreExterne } from "@/lib/projects/calendar";
import { evenementsPourProfil, profilAccesProjets } from "@/lib/projects/calendar-queries";
import { empreinte, idGoogle, versGoogle, type GoogleEventResource } from "./google-mapping";

export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.app.created"];
const API = "https://www.googleapis.com/calendar/v3";
const TIMEOUT_MS = 15_000;
const MAX_OPERATIONS = 300;

export function googleConfigure(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_TOKEN_KEY);
}

// ─── Chiffrement des jetons (AES-256-GCM) ───

function cle(): Buffer {
  const k = process.env.GOOGLE_TOKEN_KEY;
  if (!k) throw new Error("GOOGLE_TOKEN_KEY non configurée");
  return createHash("sha256").update(k).digest();
}

export function chiffrer(clair: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(), iv);
  const ct = Buffer.concat([c.update(clair, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function dechiffrer(enc: string): string {
  const [iv, tag, ct] = enc.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", cle(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

// ─── État OAuth signé (anti-CSRF) ───

export function signerEtat(profileId: string, nonce: string, ttlMs = 10 * 60_000): string {
  const payload = Buffer.from(JSON.stringify({ p: profileId, n: nonce, e: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", cle()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifierEtat(state: string, nonce: string | undefined): { ok: true; profileId: string } | { ok: false } {
  const [payload, sig] = state.split(".");
  if (!payload || !sig || !nonce) return { ok: false };
  const attendu = createHmac("sha256", cle()).update(payload).digest();
  const recu = Buffer.from(sig, "base64url");
  if (recu.length !== attendu.length || !timingSafeEqual(recu, attendu)) return { ok: false };
  try {
    const j = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { p: string; n: string; e: number };
    if (j.n !== nonce || j.e < Date.now()) return { ok: false };
    return { ok: true, profileId: j.p };
  } catch {
    return { ok: false };
  }
}

// ─── OAuth ───

export function urlAutorisation(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    // « consent » garantit la remise d'un jeton de rafraîchissement.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function appel(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export class AccesRevoque extends Error {}

async function jeton(body: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; id_token?: string; scope?: string }> {
  const res = await appel("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (!res.ok) {
    if (j.error === "invalid_grant") throw new AccesRevoque("L'accès a été retiré depuis le compte Google.");
    throw new Error(`Google a refusé le jeton (${j.error ?? res.status}).`);
  }
  return j as unknown as { access_token: string; refresh_token?: string; id_token?: string; scope?: string };
}

export const echangerCode = (code: string, redirectUri: string) =>
  jeton({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });

export const rafraichir = (refreshToken: string) => jeton({ refresh_token: refreshToken, grant_type: "refresh_token" });

/** Email du compte Google, lu dans l'id_token reçu directement de Google (TLS). */
export function emailDepuisIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const p = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return p.email ?? null;
  } catch {
    return null;
  }
}

export async function revoquer(token: string): Promise<void> {
  await appel(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
}

function entetes(access: string) {
  return { Authorization: `Bearer ${access}`, "Content-Type": "application/json", Accept: "application/json" };
}

export async function creerAgenda(access: string, nomCommune: string): Promise<string> {
  const res = await appel(`${API}/calendars`, {
    method: "POST",
    headers: entetes(access),
    body: JSON.stringify({
      summary: `GoCiviq — ${nomCommune}`,
      description: "Projets et séances de commission, mis à jour automatiquement par GoCiviq. Les modifications faites ici sont écrasées.",
      timeZone: "Europe/Paris",
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { id?: string };
  if (!res.ok || !j.id) throw new Error(`Création de l'agenda Google impossible (HTTP ${res.status}).`);
  return j.id;
}

async function nomCommune(service: SupabaseClient, communeId: string): Promise<string> {
  const { data } = await service.from("communes").select("name").eq("id", communeId).maybeSingle();
  return (data?.name as string) ?? "commune";
}

// ─── Synchronisation ───

export type GoogleSyncResult = { ok: true; crees: number; modifies: number; retires: number } | { ok: false; erreur: string };

interface LienGoogle {
  profile_id: string;
  commune_id: string;
  calendar_id: string | null;
  refresh_token_enc: string | null;
  perimetre: "tout" | "mes";
  disconnected_at: string | null;
}

async function ecrire(access: string, calendarId: string, r: GoogleEventResource, existe: boolean): Promise<void> {
  const base = `${API}/calendars/${encodeURIComponent(calendarId)}/events`;
  const put = () => appel(`${base}/${r.id}`, { method: "PUT", headers: entetes(access), body: JSON.stringify(r) });
  const post = () => appel(base, { method: "POST", headers: entetes(access), body: JSON.stringify(r) });
  let res = existe ? await put() : await post();
  if (existe && (res.status === 404 || res.status === 410)) res = await post();
  else if (!existe && res.status === 409) res = await put();
  if (!res.ok) throw new Error(`Google a refusé un événement (HTTP ${res.status}).`);
}

export async function synchroniserProfil(service: SupabaseClient, profileId: string): Promise<GoogleSyncResult> {
  const { data } = await service
    .from("google_calendar_links")
    .select("profile_id, commune_id, calendar_id, refresh_token_enc, perimetre, disconnected_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  const lien = data as LienGoogle | null;
  if (!lien || lien.disconnected_at || !lien.refresh_token_enc) return { ok: false, erreur: "Google Agenda n'est pas connecté." };

  const finir = async (r: GoogleSyncResult, extra: Record<string, unknown> = {}) => {
    await service
      .from("google_calendar_links")
      .update({ last_sync_at: new Date().toISOString(), last_sync_ok: r.ok, last_error: r.ok ? null : r.erreur.slice(0, 300), ...extra })
      .eq("profile_id", profileId);
    return r;
  };

  const acces = await profilAccesProjets(service, profileId);
  if (!acces.ok || acces.communeId !== lien.commune_id) {
    return finir({ ok: false, erreur: "Ce compte n'a plus accès au module Projets de la commune." }, { disconnected_at: new Date().toISOString() });
  }

  try {
    const { access_token: access } = await rafraichir(dechiffrer(lien.refresh_token_enc));

    // L'élu a pu supprimer l'agenda « GoCiviq » : on le recrée.
    let calendarId = lien.calendar_id;
    if (calendarId) {
      const res = await appel(`${API}/calendars/${encodeURIComponent(calendarId)}`, { headers: entetes(access) });
      if (res.status === 404 || res.status === 410) calendarId = null;
    }
    if (!calendarId) {
      calendarId = await creerAgenda(access, await nomCommune(service, lien.commune_id));
      await service.from("google_calendar_links").update({ calendar_id: calendarId }).eq("profile_id", profileId);
      await service.from("google_calendar_events").delete().eq("profile_id", profileId);
    }

    const site = getSiteUrl();
    const events = (await evenementsPourProfil(service, lien.commune_id, { id: profileId, role: acces.role }, lien.perimetre)).filter((e) => dansFenetreExterne(e));
    const actuels = new Map(events.map((e) => {
      const r = versGoogle(e, profileId, site);
      return [e.id, { r, h: empreinte(r) }] as const;
    }));
    const { data: deja } = await service.from("google_calendar_events").select("source_key, empreinte").eq("profile_id", profileId);
    const connus = new Map((deja ?? []).map((d) => [d.source_key as string, d.empreinte as string]));

    let ops = 0, crees = 0, modifies = 0, retires = 0;
    const faits: Array<{ profile_id: string; source_key: string; empreinte: string; synced_at: string }> = [];
    for (const [key, { r, h }] of actuels) {
      if (connus.get(key) === h) continue;
      if (ops++ >= MAX_OPERATIONS) break;
      await ecrire(access, calendarId, r, connus.has(key));
      if (connus.has(key)) modifies++; else crees++;
      faits.push({ profile_id: profileId, source_key: key, empreinte: h, synced_at: new Date().toISOString() });
    }
    if (faits.length) await service.from("google_calendar_events").upsert(faits, { onConflict: "profile_id,source_key" });

    const aRetirer = [...connus.keys()].filter((k) => !actuels.has(k));
    for (const key of aRetirer) {
      if (ops++ >= MAX_OPERATIONS) break;
      const id = idGoogle(key, profileId);
      const res = await appel(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${id}`, { method: "DELETE", headers: entetes(access) });
      if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google a refusé une suppression (HTTP ${res.status}).`);
      await service.from("google_calendar_events").delete().eq("profile_id", profileId).eq("source_key", key);
      retires++;
    }
    return finir({ ok: true, crees, modifies, retires });
  } catch (e) {
    if (e instanceof AccesRevoque) {
      return finir({ ok: false, erreur: e.message }, { disconnected_at: new Date().toISOString(), refresh_token_enc: null });
    }
    return finir({ ok: false, erreur: e instanceof Error ? e.message : "Erreur inconnue" });
  }
}

/** Synchronise tous les élus connectés d'une commune. */
export async function synchroniserCommuneGoogle(service: SupabaseClient, communeId: string): Promise<void> {
  if (!googleConfigure()) return;
  const { data } = await service
    .from("google_calendar_links")
    .select("profile_id")
    .eq("commune_id", communeId)
    .is("disconnected_at", null);
  for (const l of data ?? []) await synchroniserProfil(service, l.profile_id as string);
}
