import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { genererJetonFlux, lireCommissions, lirePerimetre, urlFlux } from "@/lib/calendar/feed";
import { infosAgenda } from "@/lib/projects/calendar-queries";
import { googleConfigure } from "@/lib/calendar/google";

// Lien d'abonnement iCal personnel + état de la connexion Google Agenda.
//   GET    : état
//   POST   : créer ou changer de lien { perimetre, commissions } (l'ancien cesse de fonctionner)
//   PATCH  : { perimetre?, commissions? } — commissions : liste d'ids, ou null = toutes
//   DELETE : désactiver le lien

async function etat(profileId: string, communeId: string) {
  const service = await createServiceClient();
  const [{ data: feed }, { data: g }] = await Promise.all([
    service
      .from("calendar_feeds")
      .select("token, perimetre, commissions, created_at, last_accessed_at")
      .eq("profile_id", profileId)
      .is("revoked_at", null)
      .maybeSingle(),
    service
      .from("google_calendar_links")
      .select("google_email, perimetre, commissions, connected_at, disconnected_at, last_sync_at, last_sync_ok, last_error")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);
  const infos = feed
    ? await infosAgenda(service, communeId, feed.perimetre as "tout" | "mes", (feed.commissions as string[] | null) ?? null)
    : null;
  return {
    feed: feed
      ? {
          url: urlFlux(feed.token as string, infos?.slug),
          nom: infos?.nom ?? "GoCiviq",
          perimetre: feed.perimetre,
          commissions: (feed.commissions as string[] | null) ?? null,
          created_at: feed.created_at,
          last_accessed_at: feed.last_accessed_at,
        }
      : null,
    google: {
      configured: googleConfigure(),
      connected: !!g && !g.disconnected_at,
      email: g?.google_email ?? null,
      perimetre: g?.perimetre ?? "tout",
      commissions: (g?.commissions as string[] | null | undefined) ?? null,
      last_sync_at: g?.last_sync_at ?? null,
      last_sync_ok: g?.last_sync_ok ?? null,
      last_error: g?.last_error ?? null,
    },
  };
}

async function garde() {
  const guard = await requireModule("projects");
  if (!guard.ok) return { ok: false as const, response: guard.response };
  if (!guard.communeId) return { ok: false as const, response: NextResponse.json({ error: "Aucune commune" }, { status: 403 }) };
  return { ok: true as const, userId: guard.userId, communeId: guard.communeId };
}

export async function GET() {
  const g = await garde();
  if (!g.ok) return g.response;
  return NextResponse.json(await etat(g.userId, g.communeId));
}

export async function POST(req: Request) {
  const g = await garde();
  if (!g.ok) return g.response;
  const body = (await req.json().catch(() => ({}))) as { perimetre?: unknown; commissions?: unknown };
  const perimetre = lirePerimetre(body.perimetre) ?? "tout";
  const commissions = lireCommissions(body.commissions) ?? null;
  const service = await createServiceClient();
  await service.from("calendar_feeds").update({ revoked_at: new Date().toISOString() }).eq("profile_id", g.userId).is("revoked_at", null);
  const { error } = await service
    .from("calendar_feeds")
    .insert({ profile_id: g.userId, commune_id: g.communeId, token: genererJetonFlux(), perimetre, commissions });
  if (error) return NextResponse.json({ error: "Le lien n'a pas pu être créé." }, { status: 500 });
  return NextResponse.json(await etat(g.userId, g.communeId));
}

export async function PATCH(req: Request) {
  const g = await garde();
  if (!g.ok) return g.response;
  const body = (await req.json().catch(() => ({}))) as { perimetre?: unknown; commissions?: unknown };
  const updates: Record<string, unknown> = {};
  if (body.perimetre !== undefined) {
    const perimetre = lirePerimetre(body.perimetre);
    if (!perimetre) return NextResponse.json({ error: "Périmètre invalide" }, { status: 400 });
    updates.perimetre = perimetre;
  }
  const commissions = lireCommissions(body.commissions);
  if (commissions !== undefined) updates.commissions = commissions;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  const service = await createServiceClient();
  await service.from("calendar_feeds").update(updates).eq("profile_id", g.userId).is("revoked_at", null);
  return NextResponse.json(await etat(g.userId, g.communeId));
}

export async function DELETE() {
  const g = await garde();
  if (!g.ok) return g.response;
  const service = await createServiceClient();
  await service.from("calendar_feeds").update({ revoked_at: new Date().toISOString() }).eq("profile_id", g.userId).is("revoked_at", null);
  return NextResponse.json(await etat(g.userId, g.communeId));
}
