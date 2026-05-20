/**
 * Rate limiter in-memory simple (token bucket).
 *
 * Limites :
 * • Stockage en RAM → réinitialisé à chaque cold start Vercel.
 *   Suffisant pour bloquer les abus basiques (≥ 100 req/s vers /api/responses).
 *   Pour de la prod sérieuse, brancher Upstash Redis (cf. README §V2).
 *
 * Utilisation :
 *   const rl = await rateLimit(request, { id: "responses-post", max: 10, windowMs: 60_000 });
 *   if (!rl.ok) return rl.response;
 */

import { NextRequest, NextResponse } from "next/server";

interface Bucket {
  tokens: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Purge périodique pour éviter une fuite mémoire
const GC_INTERVAL_MS = 60_000;
let lastGc = Date.now();
function gc() {
  const now = Date.now();
  if (now - lastGc < GC_INTERVAL_MS) return;
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
  lastGc = now;
}

export interface RateLimitOptions {
  /** Identifiant logique du compteur (ex: "responses-post", "auth-signup") */
  id: string;
  /** Nombre max de requêtes par fenêtre */
  max: number;
  /** Fenêtre glissante en ms */
  windowMs: number;
  /** Custom key supplémentaire (ex: user.id, survey_id) — par défaut IP */
  customKey?: string;
}

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; response: NextResponse; resetAt: number };

function clientIp(req: NextRequest): string {
  // Vercel injecte x-forwarded-for, header le plus fiable
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export function rateLimit(req: NextRequest, opts: RateLimitOptions): RateLimitResult {
  gc();
  const ip = opts.customKey ?? clientIp(req);
  const key = `${opts.id}:${ip}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { tokens: opts.max - 1, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
    return { ok: true, remaining: bucket.tokens, resetAt: bucket.resetAt };
  }

  if (bucket.tokens <= 0) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    const response = NextResponse.json(
      {
        error: "Trop de requêtes. Réessayez dans quelques instants.",
        retry_after_seconds: retryAfter,
      },
      { status: 429 }
    );
    response.headers.set("Retry-After", retryAfter.toString());
    response.headers.set("X-RateLimit-Limit", opts.max.toString());
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000).toString());
    return { ok: false, response, resetAt: bucket.resetAt };
  }

  bucket.tokens -= 1;
  return { ok: true, remaining: bucket.tokens, resetAt: bucket.resetAt };
}
