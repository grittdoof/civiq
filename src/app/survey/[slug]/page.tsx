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

  const communeName = (survey as SurveyWithCommune).communes?.name || "";
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
    <main className="civiq-page">
      {/* Dynamic header with commune branding */}
      <header
        className="civiq-header"
        style={{
          background: `linear-gradient(135deg, ${commune?.primary_color || "#1a2744"} 0%, ${commune?.primary_color || "#1a2744"}cc 100%)`,
        }}
      >
        <div className="civiq-header-inner">
          {commune?.logo_url && (
            <img
              src={commune.logo_url}
              alt={commune.name}
              className="civiq-logo"
            />
          )}
          <div className="civiq-badge">{commune?.name || "Commune"}</div>
          <h1>{survey.custom_header_text || survey.title}</h1>
          {survey.description && <p>{survey.description}</p>}
          <div className="civiq-meta">
            <span>⏱ {survey.schema?.settings?.estimated_time || "5 min"}</span>
            <span>🔒 Réponses anonymisées</span>
            {survey.ends_at && (
              <span>
                📅 Jusqu'au{" "}
                {new Date(survey.ends_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </header>

      <SurveyRenderer
        schema={survey.schema}
        surveyId={survey.id}
        communeSlug={commune?.slug || ""}
        primaryColor={commune?.primary_color}
        accentColor={commune?.accent_color}
        thankYouText={survey.custom_thank_you}
      />

      <footer className="civiq-footer">
        {commune?.name} · Sondage réalisé avec CiviQ ·{" "}
        {commune?.contact_email && (
          <a href={`mailto:${commune.contact_email}`}>{commune.contact_email}</a>
        )}
      </footer>
    </main>
  );
}
