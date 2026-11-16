import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, MapPin } from "lucide-react";
import "./convocation.css";
import { createServiceClient } from "@/lib/supabase-server";
import { getBaseUrl } from "@/lib/base-url";
import { formatSessionDate, googleCalendarUrl, outlookCalendarUrl } from "@/lib/projects/convocation";
import { calendarInputFor, loadSessionContext } from "@/lib/projects/convocation-send";
import RsvpForm from "./RsvpForm";
import { toRichHtml } from "@/lib/projects/rich-text";

// ═══════════════════════════════════════════════════════════════
// /convocation/:token — page publique de réponse à une convocation.
//
// Atteinte depuis les boutons de l'email (?reponse=present|absent) : la
// réponse est enregistrée aussitôt par le navigateur (RsvpForm) et la page
// affiche la confirmation en tête. Le serveur, lui, n'enregistre rien à
// l'ouverture du lien : les antivirus de messagerie (Outlook Safe Links,
// Gmail…) pré-ouvrent les liens sans exécuter la page.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Convocation — GoCiviq",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ reponse?: string }>;
}

export default async function ConvocationPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { reponse } = await searchParams;

  const service = await createServiceClient();
  const { data: conv } = await service
    .from("session_convocations")
    .select(
      "session_id, status, response_comment, member:commission_members ( external_name, profile:profiles!commission_members_user_id_fkey ( full_name ) )",
    )
    .eq("token", token)
    .maybeSingle();
  if (!conv) notFound();

  const ctx = await loadSessionContext(service, conv.session_id);
  if (!ctx?.commission) notFound();

  type Member = { external_name: string | null; profile: { full_name: string | null } | null } | null;
  const member = (conv as unknown as { member: Member }).member;
  const name = member?.profile?.full_name || member?.external_name || null;

  const { data: sessionMeta } = await service
    .from("commission_sessions")
    .select("compte_rendu_valide")
    .is("deleted_at", null)
    .eq("id", ctx.id)
    .maybeSingle();

  const commune = ctx.commission.commune;
  const base = getBaseUrl();
  const cal = calendarInputFor(ctx, `${base}/convocation/${token}`);
  const google = googleCalendarUrl(cal);
  const outlook = outlookCalendarUrl(cal);
  const isPast = new Date(ctx.date_seance).getTime() < Date.now() - 12 * 3600_000;
  const closed = Boolean(sessionMeta?.compte_rendu_valide) || isPast;

  const intent = reponse === "present" ? "accepted" : reponse === "absent" ? "declined" : null;
  const rsvp = (
    <RsvpForm
      token={token}
      initialStatus={conv.status as "pending" | "accepted" | "declined"}
      initialComment={conv.response_comment ?? ""}
      intent={intent}
      closed={closed}
    />
  );
  // Lieu souvent sans adresse (« Salle du conseil ») : la recherche inclut la commune.
  const itineraire = ctx.lieu
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [ctx.lieu, commune?.address ?? commune?.name].filter(Boolean).join(", "),
      )}`
    : null;

  return (
    <main className="cv-page">
      <div className="cv-card">
        <header className="cv-header">
          {commune?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={commune.logo_url} alt={commune.name} className="cv-logo" />
          ) : (
            <p className="cv-commune">🏛️ {commune?.name}</p>
          )}
          <p className="cv-eyebrow">Convocation</p>
          <h1 className="cv-title">{ctx.commission.nom}</h1>
          {name && <p className="cv-hello">Bonjour {name},</p>}
        </header>

        {intent && rsvp}

        <ul className="cv-infos">
          <li>
            <CalendarDays size={18} aria-hidden />
            <span>{formatSessionDate(ctx.date_seance)}</span>
          </li>
          {ctx.lieu && (
            <li>
              <MapPin size={18} aria-hidden />
              <span>
                {ctx.lieu}
                <a href={itineraire ?? undefined} target="_blank" rel="noreferrer" className="cv-maps">Itinéraire</a>
              </span>
            </li>
          )}
        </ul>

        {ctx.ordre_du_jour && (
          <section className="cv-odj">
            <h2>Ordre du jour</h2>
            {/* ordre_du_jour : assaini à l'écriture ET à l'affichage (page publique) */}
            <div dangerouslySetInnerHTML={{ __html: toRichHtml(ctx.ordre_du_jour) }} />
          </section>
        )}

        {!intent && rsvp}

        <section className="cv-calendar">
          <h2>Ajouter à mon agenda</h2>
          <div className="cv-calendar-buttons">
            <a href={`/api/convocations/${token}/ics`} className="cv-cal-btn">Apple</a>
            {google && <a href={google} target="_blank" rel="noreferrer" className="cv-cal-btn">Google</a>}
            {outlook && <a href={outlook} target="_blank" rel="noreferrer" className="cv-cal-btn">Outlook</a>}
          </div>
        </section>

        {commune && (
          <footer className="cv-footer">
            <strong>Mairie de {commune.name}</strong>
            {commune.address && <span>{commune.address}</span>}
            <span>
              {[commune.phone && `Tél. ${commune.phone}`, commune.contact_email].filter(Boolean).join(" · ")}
            </span>
          </footer>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-horizontal.png" alt="GoCiviq" className="cv-gociviq" />
    </main>
  );
}
