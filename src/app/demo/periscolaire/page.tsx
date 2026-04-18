import SurveyRenderer from "@/components/survey/SurveyRenderer";
import type { SurveySchema } from "@/types/survey";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Démonstration — Besoins périscolaires | CiviQ",
  description:
    "Découvrez CiviQ avec ce sondage de démonstration sur les besoins périscolaires d'une commune fictive.",
};

// ─── Schema complet du sondage périscolaire ───
// Ce schema est embarqué statiquement (pas de base de données)
// Il représente le template "Besoins périscolaires 2026-2027"

const DEMO_SCHEMA: SurveySchema = {
  settings: {
    show_progress: true,
    estimated_time: "5 min",
    allow_anonymous: true,
  },
  steps: [
    {
      id: "foyer",
      title: "Votre foyer",
      icon: "🏠",
      description:
        "Quelques informations sur votre famille pour mieux cerner vos besoins.",
      fields: [
        {
          id: "nb_enfants",
          type: "select",
          label: "Combien d'enfants scolarisés avez-vous ?",
          required: true,
          options: [
            { value: "1", label: "1 enfant" },
            { value: "2", label: "2 enfants" },
            { value: "3", label: "3 enfants" },
            { value: "4+", label: "4 enfants ou plus" },
          ],
        },
        {
          id: "niveaux",
          type: "checkbox_grid",
          label: "Niveaux scolaires de vos enfants",
          hint: "Cochez tous les niveaux concernés.",
          columns: 2,
          required: true,
          options: [
            { value: "ps", label: "Petite section", sublabel: "3 ans" },
            { value: "ms", label: "Moyenne section", sublabel: "4 ans" },
            { value: "gs", label: "Grande section", sublabel: "5 ans" },
            { value: "cp", label: "CP", sublabel: "6 ans" },
            { value: "ce1", label: "CE1", sublabel: "7 ans" },
            { value: "ce2", label: "CE2", sublabel: "8 ans" },
            { value: "cm1", label: "CM1", sublabel: "9 ans" },
            { value: "cm2", label: "CM2", sublabel: "10 ans" },
            { value: "college", label: "Collège", sublabel: "11-15 ans" },
          ],
        },
        {
          id: "situation_travail",
          type: "radio",
          label: "Quelle est votre situation professionnelle ?",
          options: [
            { value: "salarie_temps_plein", label: "Salarié(e) temps plein" },
            { value: "salarie_partiel", label: "Salarié(e) temps partiel" },
            { value: "independant", label: "Indépendant(e) / Freelance" },
            { value: "sans_emploi", label: "Sans emploi / En recherche" },
            { value: "autre", label: "Autre situation" },
          ],
        },
      ],
    },
    {
      id: "periscolaire_actuel",
      title: "Services actuels",
      icon: "🍽️",
      description: "Votre utilisation actuelle de nos services périscolaires.",
      fields: [
        {
          id: "utilise_cantine",
          type: "radio",
          label: "Vos enfants utilisent-ils la cantine ?",
          required: true,
          options: [
            {
              value: "toujours",
              label: "Tous les jours",
              sublabel: "Lundi au vendredi",
            },
            {
              value: "souvent",
              label: "Souvent",
              sublabel: "3 à 4 fois par semaine",
            },
            {
              value: "parfois",
              label: "Parfois",
              sublabel: "1 à 2 fois par semaine",
            },
            { value: "jamais", label: "Jamais" },
          ],
        },
        {
          id: "satisfaction_cantine",
          type: "scale",
          label: "Êtes-vous satisfait(e) de la cantine actuelle ?",
          min: 1,
          max: 5,
          min_label: "Pas du tout satisfait(e)",
          max_label: "Très satisfait(e)",
          conditional: {
            field: "utilise_cantine",
            value: ["toujours", "souvent", "parfois"],
          },
        },
        {
          id: "utilise_garderie_soir",
          type: "radio",
          label: "Utilisez-vous l'accueil du soir (après l'école) ?",
          required: true,
          options: [
            { value: "toujours", label: "Tous les jours" },
            { value: "souvent", label: "Souvent (3-4×/sem)" },
            { value: "parfois", label: "Parfois (1-2×/sem)" },
            { value: "jamais", label: "Jamais" },
          ],
        },
      ],
    },
    {
      id: "mercredi",
      title: "Mercredi après-midi",
      icon: "📅",
      description:
        "La commune envisage d'ouvrir un accueil le mercredi après-midi.",
      fields: [
        {
          id: "besoin_mercredi",
          type: "radio",
          label:
            "Seriez-vous intéressé(e) par un accueil le mercredi après-midi ?",
          required: true,
          options: [
            {
              value: "oui_regulier",
              label: "Oui, tous les mercredis",
              sublabel: "Besoin régulier et prévisible",
            },
            {
              value: "oui_occasionnel",
              label: "Oui, occasionnellement",
              sublabel: "Selon les besoins ponctuels",
            },
            { value: "non", label: "Non, pas besoin" },
          ],
        },
        {
          id: "mercredi_creneaux",
          type: "checkbox_grid",
          label: "Quels créneaux vous conviendraient ?",
          columns: 2,
          conditional: {
            field: "besoin_mercredi",
            value: ["oui_regulier", "oui_occasionnel"],
          },
          options: [
            { value: "matin", label: "Matin", sublabel: "8h – 12h" },
            {
              value: "aprem",
              label: "Après-midi",
              sublabel: "13h30 – 17h30",
            },
            { value: "journee", label: "Journée complète", sublabel: "8h – 17h30" },
            { value: "repas", label: "Avec repas du midi" },
          ],
        },
        {
          id: "mercredi_nb_enfants",
          type: "select",
          label: "Combien d'enfants seraient concernés ?",
          conditional: {
            field: "besoin_mercredi",
            value: ["oui_regulier", "oui_occasionnel"],
          },
          options: [
            { value: "1", label: "1 enfant" },
            { value: "2", label: "2 enfants" },
            { value: "3+", label: "3 enfants ou plus" },
          ],
        },
      ],
    },
    {
      id: "vacances",
      title: "Vacances scolaires",
      icon: "🌴",
      description:
        "Un accueil type centre de loisirs pendant les vacances scolaires.",
      fields: [
        {
          id: "besoin_vacances",
          type: "radio",
          label:
            "Seriez-vous intéressé(e) par un accueil pendant les vacances scolaires ?",
          required: true,
          options: [
            {
              value: "oui_toutes",
              label: "Oui, pour toutes les vacances",
              sublabel: "Toussaint, Noël, Hiver, Printemps, Été",
            },
            {
              value: "oui_certaines",
              label: "Oui, pour certaines vacances",
              sublabel: "Selon les périodes",
            },
            { value: "non", label: "Non, sans intérêt pour moi" },
          ],
        },
        {
          id: "vacances_periodes",
          type: "checkbox_grid",
          label: "Quelles périodes vous intéressent ?",
          columns: 2,
          conditional: {
            field: "besoin_vacances",
            value: ["oui_toutes", "oui_certaines"],
          },
          options: [
            { value: "toussaint", label: "Toussaint", sublabel: "Octobre" },
            { value: "noel", label: "Noël", sublabel: "Décembre-Janvier" },
            { value: "hiver", label: "Hiver", sublabel: "Février" },
            { value: "printemps", label: "Printemps", sublabel: "Avril" },
            {
              value: "ete_juillet",
              label: "Été – Juillet",
              sublabel: "Juillet",
            },
            { value: "ete_aout", label: "Été – Août", sublabel: "Août" },
          ],
        },
        {
          id: "college_accueil",
          type: "radio",
          label:
            "Seriez-vous intéressé(e) par un accueil pour les collégiens (6ème–3ème) pendant les vacances ?",
          required: true,
          options: [
            { value: "oui", label: "Oui, absolument" },
            { value: "peut_etre", label: "Peut-être" },
            { value: "non", label: "Non" },
          ],
        },
        {
          id: "vacances_activites",
          type: "checkbox_grid",
          label: "Quelles activités plairaient à vos enfants ?",
          columns: 2,
          conditional: {
            field: "besoin_vacances",
            value: ["oui_toutes", "oui_certaines"],
          },
          options: [
            { value: "sport", label: "Sports collectifs" },
            { value: "arts", label: "Arts créatifs" },
            { value: "nature", label: "Nature & découverte" },
            { value: "numerique", label: "Numérique & robotique" },
            { value: "cuisine", label: "Cuisine & gastronomie" },
            { value: "sorties", label: "Sorties culturelles" },
          ],
        },
      ],
    },
    {
      id: "engagement",
      title: "Aide aux devoirs & bénévolat",
      icon: "📚",
      description:
        "La commune souhaite mobiliser des bénévoles pour enrichir l'offre périscolaire.",
      fields: [
        {
          id: "aide_devoirs",
          type: "radio",
          label: "Un service d'aide aux devoirs vous intéresserait-il ?",
          required: true,
          options: [
            {
              value: "oui_primaire",
              label: "Oui, pour les élèves de primaire",
              sublabel: "CP à CM2",
            },
            {
              value: "oui_college",
              label: "Oui, pour les collégiens",
              sublabel: "6ème à 3ème",
            },
            { value: "oui_les_deux", label: "Oui, pour les deux niveaux" },
            { value: "non", label: "Non" },
          ],
        },
        {
          id: "benevole_devoirs",
          type: "radio",
          label:
            "Seriez-vous prêt(e) à vous porter bénévole pour l'aide aux devoirs ?",
          conditional: {
            field: "aide_devoirs",
            value: ["oui_primaire", "oui_college", "oui_les_deux"],
          },
          options: [
            { value: "oui", label: "Oui, je suis volontaire" },
            {
              value: "peut_etre",
              label: "Peut-être",
              sublabel: "Selon mes disponibilités",
            },
            { value: "non", label: "Non" },
          ],
        },
        {
          id: "benevole_activite",
          type: "radio",
          label:
            "Avez-vous une compétence ou passion à partager lors d'activités bénévoles ?",
          hint: "Sport, musique, arts, langues, numérique, jardinage…",
          options: [
            { value: "oui_regulier", label: "Oui, de façon régulière" },
            { value: "oui_ponctuel", label: "Oui, ponctuellement" },
            { value: "non", label: "Non" },
          ],
        },
        {
          id: "benevole_domaine",
          type: "checkbox_grid",
          label: "Dans quel(s) domaine(s) pourriez-vous contribuer ?",
          columns: 2,
          conditional: {
            field: "benevole_activite",
            value: ["oui_regulier", "oui_ponctuel"],
          },
          options: [
            { value: "sport", label: "Sport" },
            { value: "musique", label: "Musique / Chant" },
            { value: "arts", label: "Arts plastiques" },
            { value: "langues", label: "Langues étrangères" },
            { value: "numerique", label: "Numérique / Informatique" },
            { value: "nature", label: "Nature / Jardinage" },
            { value: "cuisine", label: "Cuisine" },
            { value: "autre", label: "Autre" },
          ],
        },
        {
          id: "commentaire",
          type: "textarea",
          label: "Vos suggestions et commentaires libres",
          placeholder:
            "Avez-vous d'autres besoins, idées ou suggestions pour améliorer l'offre périscolaire de notre commune ?",
          hint: "Toutes vos idées sont précieuses pour construire une offre adaptée.",
        },
      ],
    },
  ],
};

export default function DemoPage() {
  return (
    <main className="civiq-page">
      {/* Header */}
      <header
        className="civiq-header"
        style={{
          background:
            "linear-gradient(135deg, #1a2744 0%, #243a5e 50%, #3b6fa0 100%)",
        }}
      >
        <div className="civiq-header-inner">
          <div className="civiq-badge">🏛 Commune de Châteauneuf — Démonstration</div>
          <h1>Besoins périscolaires 2026–2027</h1>
          <p>
            Aidez-nous à construire l'offre périscolaire qui correspond à vos
            besoins : mercredi après-midi, vacances scolaires, aide aux devoirs,
            bénévolat et plus encore.
          </p>
          <div className="civiq-meta">
            <span>⏱ Environ 5 minutes</span>
            <span>🔒 Réponses anonymisées</span>
            <span>📅 Jusqu'au 30 juin 2026</span>
          </div>
        </div>

        {/* Demo banner */}
        <div className="demo-banner">
          <span>
            👁 Ceci est une <strong>démonstration</strong> — les réponses ne
            sont pas enregistrées.
          </span>
          <Link href="/auth/register" className="demo-cta">
            Créer mon espace commune →
          </Link>
        </div>
      </header>

      <SurveyRenderer
        schema={DEMO_SCHEMA}
        surveyId="demo"
        communeSlug="chateauneuf-demo"
        primaryColor="#1a2744"
        accentColor="#c9a84c"
        thankYouText="Merci d'avoir testé CiviQ ! Dans une vraie commune, vos réponses auraient été enregistrées et analysées par les élus."
        onSubmit={async () => {
          // Demo mode: simulate a small delay, no DB save
          await new Promise((r) => setTimeout(r, 800));
        }}
      />

      <footer className="civiq-footer">
        Commune de Châteauneuf (démonstration) · Sondage réalisé avec{" "}
        <Link href="/" style={{ color: "#3b6fa0" }}>
          CiviQ
        </Link>
      </footer>

      <style>{`
        .demo-banner {
          background: rgba(201,168,76,0.15);
          border-top: 1px solid rgba(201,168,76,0.3);
          border-bottom: 1px solid rgba(201,168,76,0.3);
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 14px;
        }
        .demo-banner span { color: rgba(255,255,255,0.9); }
        .demo-banner strong { color: #e8d596; }
        .demo-cta {
          background: #c9a84c;
          color: #1a2744;
          padding: 8px 18px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          transition: 0.2s;
        }
        .demo-cta:hover { background: #d4b65f; }
        @media (max-width: 600px) {
          .demo-banner { justify-content: center; text-align: center; }
        }
      `}</style>
    </main>
  );
}
