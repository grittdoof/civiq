import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import {
  chiffrer,
  creerAgenda,
  echangerCode,
  emailDepuisIdToken,
  googleConfigure,
  revoquer,
  synchroniserProfil,
  verifierEtat,
} from "@/lib/calendar/google";

// GET /api/google-calendar/callback — retour de Google après consentement.
// Seul un code de résultat part dans l'URL de retour (aucune donnée personnelle).

export const maxDuration = 60;

const NONCE_COOKIE = "gcal_nonce";

export async function GET(req: NextRequest) {
  const retour = (code: string) => {
    const res = NextResponse.redirect(new URL(`/admin/calendrier?google=${code}#agenda`, req.nextUrl.origin));
    res.cookies.set(NONCE_COOKIE, "", { path: "/api/google-calendar", maxAge: 0 });
    return res;
  };
  if (!googleConfigure()) return retour("indisponible");

  const q = req.nextUrl.searchParams;
  if (q.get("error")) return retour("refuse");
  const code = q.get("code");
  const state = q.get("state");
  if (!code || !state) return retour("erreur");

  const guard = await requireModule("projects");
  if (!guard.ok || !guard.communeId) return retour("erreur");
  const etat = verifierEtat(state, req.cookies.get(NONCE_COOKIE)?.value);
  if (!etat.ok || etat.profileId !== guard.userId) return retour("expire");

  const service = await createServiceClient();
  let refresh: string | undefined;
  try {
    const t = await echangerCode(code, `${req.nextUrl.origin}/api/google-calendar/callback`);
    refresh = t.refresh_token;
    if (!refresh) return retour("erreur");
    if (!(t.scope ?? "").includes("calendar.app.created")) {
      await revoquer(refresh);
      return retour("portee");
    }

    const { data: existant } = await service
      .from("google_calendar_links")
      .select("calendar_id, perimetre")
      .eq("profile_id", guard.userId)
      .maybeSingle();
    const { data: commune } = await service.from("communes").select("name").eq("id", guard.communeId).maybeSingle();
    const calendarId = existant?.calendar_id ?? (await creerAgenda(t.access_token, (commune?.name as string) ?? "commune"));

    const { error } = await service.from("google_calendar_links").upsert(
      {
        profile_id: guard.userId,
        commune_id: guard.communeId,
        google_email: emailDepuisIdToken(t.id_token),
        calendar_id: calendarId,
        refresh_token_enc: chiffrer(refresh),
        perimetre: existant?.perimetre ?? "tout",
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        last_error: null,
      },
      { onConflict: "profile_id" },
    );
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[google-agenda] connexion", e);
    if (refresh) await revoquer(refresh);
    return retour("erreur");
  }

  const r = await synchroniserProfil(service, guard.userId);
  return retour(r.ok ? "connecte" : "connecte_erreur");
}
