import type { SurveySchema, SurveyField } from "@/types/survey";

// ═══════════════════════════════════════════════════════════════
// MODÈLES D'ÉVÉNEMENT
//
// Formulaires d'inscription prêts à l'emploi proposés à la création
// d'un événement. Chaque modèle arrive avec le mode événement déjà
// activé, les écrans d'étape masqués (on enchaîne les questions) et
// un intitulé de bouton adapté.
//
// Ces modèles vivent en TypeScript et non dans `survey_templates` :
// ils sont identiques pour toutes les communes et évoluent avec le
// code, sans migration ni seed à rejouer.
// ═══════════════════════════════════════════════════════════════

export interface EventTemplate {
  id: string;
  title: string;
  /** Titre pré-rempli si l'utilisateur n'en a pas saisi */
  suggestedTitle: string;
  description: string;
  icon: string;
  schema: SurveySchema;
}

// ─── Champs réutilisés d'un modèle à l'autre ───

const NAME_FIELD: SurveyField = {
  id: "nom",
  type: "text",
  label: "Votre nom et prénom",
  required: true,
};

const EMAIL_FIELD: SurveyField = {
  id: "email",
  type: "email",
  label: "Votre email",
  hint: "Pour recevoir la confirmation de votre inscription",
  required: true,
};

const PHONE_FIELD: SurveyField = {
  id: "telephone",
  type: "tel",
  label: "Votre téléphone",
  hint: "Pour vous prévenir en cas de changement",
};

function participantsField(label = "Combien serez-vous ?"): SurveyField {
  return {
    id: "nb_participants",
    type: "number",
    label,
    required: true,
    min: 1,
    max: 20,
  };
}

function buildSchema(
  stepTitle: string,
  fields: SurveyField[],
  startCta: string
): SurveySchema {
  return {
    settings: {
      show_progress: true,
      hide_step_intros: true,
      start_cta: startCta,
      event: { enabled: true },
    },
    steps: [
      {
        id: "inscription",
        title: stepTitle,
        icon: "CalendarDays",
        fields,
      },
    ],
  };
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: "blank",
    title: "Inscription simple",
    suggestedTitle: "",
    description: "Nom, email, téléphone et nombre de participants.",
    icon: "📝",
    schema: buildSchema(
      "Votre inscription",
      [NAME_FIELD, EMAIL_FIELD, PHONE_FIELD, participantsField()],
      "Je m'inscris"
    ),
  },

  {
    id: "reunion",
    title: "Réunion publique",
    suggestedTitle: "Réunion publique",
    description:
      "Conseil municipal, réunion de quartier, présentation de projet. Recueille les questions à l'avance.",
    icon: "🏛",
    schema: buildSchema(
      "Votre participation",
      [
        NAME_FIELD,
        EMAIL_FIELD,
        participantsField("Combien de personnes vous accompagnent ? (vous compris)"),
        {
          id: "quartier",
          type: "text",
          label: "Votre quartier ou hameau",
          hint: "Facultatif — nous aide à équilibrer les sujets abordés",
        },
        {
          id: "question",
          type: "textarea",
          label: "Une question à poser lors de la réunion ?",
          placeholder: "Votre question sera transmise aux élus en amont…",
        },
      ],
      "Je participe"
    ),
  },

  {
    id: "fete",
    title: "Fête ou repas de village",
    suggestedTitle: "Repas de village",
    description:
      "Repas, fête des voisins, cérémonie. Compte les adultes et enfants, les régimes et les bénévoles.",
    icon: "🎉",
    schema: buildSchema(
      "Votre inscription",
      [
        NAME_FIELD,
        EMAIL_FIELD,
        PHONE_FIELD,
        {
          id: "nb_adultes",
          type: "number",
          label: "Nombre d'adultes",
          required: true,
          min: 1,
          max: 20,
        },
        {
          id: "nb_enfants",
          type: "number",
          label: "Nombre d'enfants (moins de 12 ans)",
          min: 0,
          max: 20,
        },
        {
          id: "regimes",
          type: "checkbox",
          label: "Régimes alimentaires particuliers",
          hint: "Plusieurs choix possibles",
          options: [
            { value: "aucun", label: "Aucun" },
            { value: "vegetarien", label: "Végétarien" },
            { value: "sans_porc", label: "Sans porc" },
            { value: "sans_gluten", label: "Sans gluten" },
            { value: "allergie", label: "Allergie (précisée ci-dessous)" },
          ],
        },
        {
          id: "allergies",
          type: "text",
          label: "Précisez l'allergie",
          conditional: { field: "regimes", value: "allergie" },
        },
        {
          id: "benevole",
          type: "radio",
          label: "Souhaitez-vous donner un coup de main ?",
          options: [
            { value: "non", label: "Non merci" },
            { value: "installation", label: "Oui, pour l'installation" },
            { value: "service", label: "Oui, pendant le service" },
            { value: "rangement", label: "Oui, pour le rangement" },
          ],
        },
      ],
      "Je réserve ma place"
    ),
  },

  {
    id: "atelier",
    title: "Atelier ou activité",
    suggestedTitle: "Atelier",
    description:
      "Places limitées, choix de créneau et niveau. Idéal pour les ateliers, stages et initiations.",
    icon: "🎨",
    schema: buildSchema(
      "Votre inscription",
      [
        NAME_FIELD,
        EMAIL_FIELD,
        PHONE_FIELD,
        {
          id: "creneau",
          type: "select",
          label: "Créneau souhaité",
          hint: "Dans la limite des places disponibles",
          required: true,
          options: [
            { value: "matin", label: "Matin" },
            { value: "apres_midi", label: "Après-midi" },
            { value: "indifferent", label: "Indifférent" },
          ],
        },
        {
          id: "niveau",
          type: "radio",
          label: "Votre niveau",
          options: [
            { value: "debutant", label: "Débutant" },
            { value: "intermediaire", label: "Intermédiaire" },
            { value: "confirme", label: "Confirmé" },
          ],
        },
        {
          id: "besoins",
          type: "textarea",
          label: "Un besoin particulier ?",
          placeholder: "Accessibilité, matériel, accompagnement…",
        },
      ],
      "Je réserve ma place"
    ),
  },

  {
    id: "sortie",
    title: "Sortie ou voyage",
    suggestedTitle: "Sortie",
    description:
      "Excursion, visite, voyage organisé. Gère le transport et les besoins d'accessibilité.",
    icon: "🚌",
    schema: buildSchema(
      "Votre inscription",
      [
        NAME_FIELD,
        EMAIL_FIELD,
        PHONE_FIELD,
        participantsField("Nombre de participants (vous compris)"),
        {
          id: "transport",
          type: "radio",
          label: "Comment vous rendez-vous sur place ?",
          required: true,
          options: [
            { value: "bus", label: "Bus organisé par la commune" },
            { value: "personnel", label: "Véhicule personnel" },
            {
              value: "covoiturage",
              label: "Covoiturage",
              sublabel: "Nous vous mettrons en relation",
            },
          ],
        },
        {
          id: "mobilite",
          type: "radio",
          label: "Besoin d'accessibilité ?",
          options: [
            { value: "non", label: "Non" },
            { value: "oui", label: "Oui (précisé ci-dessous)" },
          ],
        },
        {
          id: "mobilite_detail",
          type: "text",
          label: "Précisez votre besoin",
          conditional: { field: "mobilite", value: "oui" },
        },
      ],
      "Je m'inscris à la sortie"
    ),
  },

  {
    id: "exposant",
    title: "Vide-grenier ou marché",
    suggestedTitle: "Vide-grenier",
    description:
      "Inscription des exposants : métrage, type de stand, véhicule sur place.",
    icon: "🧺",
    schema: buildSchema(
      "Votre emplacement",
      [
        NAME_FIELD,
        EMAIL_FIELD,
        PHONE_FIELD,
        {
          id: "type_exposant",
          type: "radio",
          label: "Vous êtes",
          required: true,
          options: [
            { value: "particulier", label: "Un particulier" },
            { value: "association", label: "Une association" },
            { value: "professionnel", label: "Un professionnel" },
          ],
        },
        {
          id: "metrage",
          type: "number",
          label: "Métrage souhaité (en mètres linéaires)",
          required: true,
          min: 1,
          max: 20,
        },
        {
          id: "vehicule",
          type: "radio",
          label: "Souhaitez-vous garder votre véhicule sur l'emplacement ?",
          options: [
            { value: "non", label: "Non" },
            { value: "oui", label: "Oui" },
          ],
        },
        {
          id: "produits",
          type: "textarea",
          label: "Que proposerez-vous ?",
          placeholder: "Vêtements, jouets, livres, artisanat…",
        },
      ],
      "Je réserve mon emplacement"
    ),
  },
];

export function getEventTemplate(id: string): EventTemplate | undefined {
  return EVENT_TEMPLATES.find((t) => t.id === id);
}
