import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/sentry-test?token=<SENTRY_TEST_TOKEN>
 *
 * Route de vérification Sentry côté serveur (Node.js runtime).
 * À appeler depuis Vercel pour vérifier que les événements remontent.
 *
 * Protection : header Authorization ou query param ?token=
 * La valeur attendue est SENTRY_TEST_TOKEN (ou CRON_SECRET en fallback).
 *
 * Exemples :
 *   curl https://gociviq.fr/api/sentry-test?token=xxx
 *   curl -H "Authorization: Bearer xxx" https://gociviq.fr/api/sentry-test
 *
 * Réponse JSON :
 *   { ok: true, sentry_dsn_configured: bool, event_id: string, message_id: string }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const secret =
    process.env.SENTRY_TEST_TOKEN ||
    process.env.CRON_SECRET;

  if (secret) {
    const authHeader = request.headers.get("authorization");
    const queryToken = request.nextUrl.searchParams.get("token");
    const provided = authHeader?.replace(/^Bearer\s+/i, "") || queryToken;

    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // En prod, refuser si aucun secret n'est configuré
    return NextResponse.json(
      { error: "SENTRY_TEST_TOKEN not configured" },
      { status: 500 },
    );
  }

  const dsnConfigured = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

  // ── Test 1 : captureMessage ───────────────────────────────────────────
  const messageId = Sentry.captureMessage(
    "[CiviQ] Sentry server-side test — captureMessage",
    {
      level: "info",
      tags: { test: "true", runtime: "nodejs" },
    },
  );

  // ── Test 2 : captureException avec stack trace ────────────────────────
  let eventId = "";
  try {
    throw new Error("[CiviQ] Sentry server-side test — intentional error");
  } catch (err) {
    eventId = Sentry.captureException(err, {
      tags: { test: "true", runtime: "nodejs" },
      extra: { triggered_by: "sentry-test route", timestamp: new Date().toISOString() },
    });
  }

  // Flush pour s'assurer que les events sont envoyés avant la fin de la lambda
  await Sentry.flush(3000);

  return NextResponse.json({
    ok: true,
    sentry_dsn_configured: dsnConfigured,
    message_id: messageId,
    event_id: eventId,
    note: dsnConfigured
      ? "Vérifier les events dans sentry.io (Issues + Performance)"
      : "⚠️  NEXT_PUBLIC_SENTRY_DSN non configuré — events non envoyés",
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    env: process.env.NODE_ENV,
  });
}
