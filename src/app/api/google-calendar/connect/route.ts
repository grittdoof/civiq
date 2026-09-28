import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { googleConfigure, signerEtat, urlAutorisation } from "@/lib/calendar/google";

// GET /api/google-calendar/connect — redirige vers l'écran de consentement
// Google. L'état est signé et lié à un cookie (anti-CSRF).

const NONCE_COOKIE = "gcal_nonce";

export async function GET(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!googleConfigure()) return NextResponse.json({ error: "Google Agenda n'est pas configuré sur cette plateforme." }, { status: 404 });

  const nonce = randomBytes(16).toString("base64url");
  const redirectUri = `${req.nextUrl.origin}/api/google-calendar/callback`;
  const res = NextResponse.redirect(urlAutorisation(redirectUri, signerEtat(guard.userId, nonce)));
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/google-calendar",
    maxAge: 600,
  });
  return res;
}
