import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getSiteUrl } from "@/lib/email";
import { buildIcsCalendar } from "@/lib/calendar/ics";
import { dansFenetreExterne, versIcs } from "@/lib/projects/calendar";
import { evenementsPourProfil, infosAgenda, profilAccesProjets } from "@/lib/projects/calendar-queries";

// Flux iCal personnel, lu par les agendas (Google, Apple, Outlook) sans
// session. Le jeton seul donne l'accès : lien inconnu, désactivé ou
// titulaire sans accès ⇒ 404, sans détail. Partagé par
// /api/agenda/<jeton>.ics et /api/agenda/<jeton>/<nom>.ics.

const introuvable = () => new NextResponse("Not found", { status: 404 });

export async function servirFlux(brut: string): Promise<NextResponse> {
  const token = brut.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return introuvable();

  const service = await createServiceClient();
  const { data: feed } = await service
    .from("calendar_feeds")
    .select("id, profile_id, commune_id, perimetre, commissions, last_accessed_at")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();
  if (!feed) return introuvable();

  const acces = await profilAccesProjets(service, feed.profile_id as string);
  if (!acces.ok || acces.communeId !== feed.commune_id) return introuvable();

  const perimetre = feed.perimetre as "tout" | "mes";
  const commissions = (feed.commissions as string[] | null) ?? null;
  const [events, infos] = await Promise.all([
    evenementsPourProfil(service, feed.commune_id as string, { id: feed.profile_id as string, role: acces.role }, perimetre, commissions),
    infosAgenda(service, feed.commune_id as string, perimetre, commissions),
  ]);
  const ics = buildIcsCalendar(versIcs(events.filter((e) => dansFenetreExterne(e)), getSiteUrl()), {
    name: infos.nom,
    description: "Étapes des projets et séances de commission. Lien personnel : ne le partagez pas.",
  });

  // Dernier accès, au plus une écriture par heure.
  const last = feed.last_accessed_at ? Date.parse(feed.last_accessed_at as string) : 0;
  if (Date.now() - last > 3_600_000) {
    await service.from("calendar_feeds").update({ last_accessed_at: new Date().toISOString() }).eq("id", feed.id);
  }

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${infos.slug}.ics"`,
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex",
    },
  });
}
