// ═══════════════════════════════════════════════════════════════
// Synchronisation Aides-territoires → aides_cache (serveur uniquement).
//
// • La clé API est un secret d'environnement (AIDES_TERRITOIRES_API_KEY),
//   jamais en base ni côté client. Elle est échangée contre un jeton
//   Bearer valable 24 h (POST /api/connexion/, en-tête X-AUTH-TOKEN).
// • Appelée par la tâche planifiée hebdomadaire (et, ponctuellement, par
//   un administrateur) — jamais pendant le rendu d'une page.
// • Dégradation gracieuse : en cas d'échec, l'ancien cache est conservé
//   et l'erreur est journalisée (aides_sync_log).
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTRIBUTION, lirePage, normaliserAide, type AideCache } from "./aides";

const BASE = ATTRIBUTION.url;
const TIMEOUT_MS = 15_000;
const MAX_PAGES = 40;

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${new URL(url).pathname}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function obtenirJeton(apiKey: string): Promise<string> {
  const json = (await fetchJson(`${BASE}/api/connexion/`, {
    method: "POST",
    headers: { "X-AUTH-TOKEN": apiKey, Accept: "application/json" },
  })) as { token?: string };
  if (!json?.token) throw new Error("Connexion Aides-territoires refusée (clé API invalide ?)");
  return json.token;
}

/** Toutes les aides ouvertes aux communes sur le périmètre d'un code INSEE. */
export async function recupererAides(token: string, codeInsee: string): Promise<AideCache[]> {
  const params = new URLSearchParams({ perimeter_codes: codeInsee, organization_type_slugs: "commune" });
  let url: string | null = `${BASE}/api/aids/?${params}`;
  const out = new Map<string, AideCache>();
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const json = await fetchJson(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    const { items, next } = lirePage(json);
    for (const raw of items) {
      const a = normaliserAide(raw);
      if (a) out.set(a.aide_id, a);
    }
    url = next ? new URL(next, BASE).toString() : null;
  }
  return [...out.values()];
}

export type SyncResult = { ok: true; nb: number } | { ok: false; erreur: string };

export async function synchroniserCommune(
  service: SupabaseClient,
  communeId: string,
  codeInsee: string,
): Promise<SyncResult> {
  const { data: log } = await service.from("aides_sync_log").insert({ commune_id: communeId }).select("id").single();
  const finir = async (r: SyncResult) => {
    if (log) {
      await service.from("aides_sync_log").update({
        finished_at: new Date().toISOString(),
        ok: r.ok,
        nb_aides: r.ok ? r.nb : null,
        erreur: r.ok ? null : r.erreur.slice(0, 500),
      }).eq("id", log.id);
    }
    return r;
  };

  const apiKey = process.env.AIDES_TERRITOIRES_API_KEY;
  if (!apiKey) return finir({ ok: false, erreur: "Clé API Aides-territoires non configurée (AIDES_TERRITOIRES_API_KEY)." });

  try {
    const token = await obtenirJeton(apiKey);
    const aides = await recupererAides(token, codeInsee);
    // Un résultat vide est suspect (filtre ou API modifiés) : on garde l'ancien cache.
    if (aides.length === 0) return finir({ ok: false, erreur: "Aucune aide renvoyée : cache précédent conservé." });

    const now = new Date().toISOString();
    for (let i = 0; i < aides.length; i += 200) {
      const chunk = aides.slice(i, i + 200).map((a) => ({ ...a, commune_id: communeId, fetched_at: now }));
      const { error } = await service.from("aides_cache").upsert(chunk, { onConflict: "commune_id,aide_id" });
      if (error) throw new Error(error.message);
    }
    // Cache technique (pas une donnée métier) : on retire les aides disparues.
    await service.from("aides_cache").delete().eq("commune_id", communeId).lt("fetched_at", now);
    return finir({ ok: true, nb: aides.length });
  } catch (e) {
    return finir({ ok: false, erreur: e instanceof Error ? e.message : "Erreur inconnue" });
  }
}

/** Communes à synchroniser : module projets actif et code INSEE renseigné. */
export async function communesASynchroniser(service: SupabaseClient): Promise<Array<{ commune_id: string; code_insee: string }>> {
  const [{ data: settings }, { data: modules }] = await Promise.all([
    service.from("commune_settings").select("commune_id, code_insee").not("code_insee", "is", null),
    service.from("commune_modules").select("commune_id").eq("module_id", "projects"),
  ]);
  const actives = new Set((modules ?? []).map((m) => m.commune_id as string));
  return ((settings ?? []) as Array<{ commune_id: string; code_insee: string }>).filter((s) => actives.has(s.commune_id));
}

/** Contrôle du secret des tâches planifiées (même règle que les autres crons). */
export function cronAutorise(authHeader: string | null): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.CRON_SECRET;
  if (secret) return authHeader === `Bearer ${secret}` ? { ok: true } : { ok: false, status: 401, error: "Unauthorized" };
  if (process.env.NODE_ENV === "production") return { ok: false, status: 500, error: "CRON_SECRET non configuré" };
  return { ok: true };
}
