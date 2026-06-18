import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import SurveyRenderer from "@/components/survey/SurveyRenderer";
import type { Survey, Commune } from "@/types/survey";
import type { Metadata } from "next";

// Type retourné par Supabase lors du join surveys + communes
type SurveyWithCommune = Omit<Survey, "commune"> & {
  communes: Commune | null;
};

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ commune?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { commune } = await searchParams;
  const supabase = await createClient();

  const { data: survey } = await supabase
    .from("surveys")
    .select("title, description, communes(name)")
    .eq("slug", slug)
    .maybeSingle();

  if (!survey) return { title: "Sondage introuvable" };

  const communeName = (survey as unknown as SurveyWithCommune).communes?.name || "";
  return {
    title: `${survey.title} — ${communeName}`,
    description: survey.description || `Participez au sondage de ${communeName}`,
  };
}

export default async function SurveyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { commune: communeSlug } = await searchParams;
  const supabase = await createClient();

  // Fetch survey (tous statuts) — on filtre sur le statut après pour
  // distinguer "introuvable" de "non encore publié"
  let query = supabase
    .from("surveys")
    .select("*, communes(*)")
    .eq("slug", slug);

  if (communeSlug) {
    query = query.eq("communes.slug", communeSlug);
  }

  const { data: survey, error } = await query.maybeSingle();

  if (!survey || error) notFound();

  const commune = (survey as SurveyWithCommune).communes;

  // Sondage existe mais n'est pas encore publié
  if (survey.status !== "published") {
    return (
      <main className="civiq-page">
        <div className="civiq-closed">
          <h1>Sondage non encore publié</h1>
          <p>
            Ce sondage est actuellement en {survey.status === "draft" ? "brouillon" : survey.status}.
            Il sera accessible au public dès sa publication.
          </p>
        </div>
      </main>
    );
  }

  // Check dates
  const now = new Date();
  if (survey.ends_at && new Date(survey.ends_at) < now) {
    return (
      <main className="civiq-page">
        <div className="civiq-closed">
          <h1>Sondage terminé</h1>
          <p>Ce sondage n'accepte plus de réponses. Merci de votre intérêt.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="civiq-page civiq-page-flow">
      <SurveyRenderer
        schema={survey.schema}
        surveyId={survey.id}
        communeSlug={commune?.slug || ""}
        primaryColor={commune?.primary_color}
        accentColor={commune?.accent_color}
        thankYouText={survey.custom_thank_you}
        surveyTitle={survey.custom_header_text || survey.title}
        surveyDescription={survey.description || undefined}
        communeName={commune?.name}
        communeLogoUrl={commune?.logo_url || undefined}
        estimatedTime={survey.schema?.settings?.estimated_time}
        allowAnonymous={survey.schema?.settings?.allow_anonymous}
        endsAt={survey.ends_at || undefined}
        requireConsent={survey.rgpd_require_consent !== false}
        consentText={survey.rgpd_consent_text || undefined}
        rgpdFinalite={survey.rgpd_finalite || undefined}
        rgpdDureeJours={survey.rgpd_duree_conservation_jours || undefined}
        rgpdContactEmail={commune?.contact_email}
      />

      <footer className="civiq-footer">
        {commune?.name} · Sondage réalisé avec GoCiviq ·{" "}
        {commune?.contact_email && (
          <a href={`mailto:${commune.contact_email}`}>{commune.contact_email}</a>
        )}
      </footer>
    </main>
  );
}
