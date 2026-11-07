"use client";

import { useCallback, useMemo, useState } from "react";
import type { TicketCanal } from "@/lib/tickets/types";
import type { Urgence } from "@/lib/tickets/categories";
import type { LocationValue } from "@/components/tickets/TicketLocationPicker";

// ═══════════════════════════════════════════════════════════════
// useTicketWizard — source de vérité unique du wizard de création.
// Découple ordre/état/validation/visibilité du rendu, pour pouvoir
// brancher plus tard une variante accordéon sans dupliquer la logique.
// ═══════════════════════════════════════════════════════════════

export type WizardStepId =
  | "canal"
  | "demandeur"
  | "categorie"
  | "periscolaire"
  | "description"
  | "priorite"
  | "localisation"
  | "photos"
  | "assignation"
  | "visibilite";

export interface WizardValue {
  canal: TicketCanal;
  demandeur_nom: string;
  demandeur_telephone: string;
  demandeur_email: string;
  demandeur_adresse: string;
  titre: string;
  description: string;
  /** Sous-catégorie (ou catégorie) choisie — lot 2. */
  categorieId: string | null;
  urgence: Urgence;
  location: LocationValue;
  photoPaths: string[];
  assigneIds: string[];
  echeance: string;
  /** Lot 1 : service, niveau de visibilité, destinataires nommés. */
  serviceId: string;
  confidentialite: "standard" | "restreint" | "confidentiel";
  destinataireIds: string[];
  /** Lot 5 : précisions d'un signalement périscolaire (étape visible si la catégorie l'est). */
  estPeriscolaire: boolean;
  siteId: string;
  creneau: "" | "matin" | "midi" | "soir" | "mercredi" | "vacances";
  enfant: string;
  familleInformee: "" | "oui" | "non";
}

export interface WizardStep {
  id: WizardStepId;
  title: string;
  eyebrow: string;
  subtitle?: string;
  optional?: boolean;
}

interface StepDef extends WizardStep {
  isVisible: (v: WizardValue) => boolean;
  isValid: (v: WizardValue) => boolean;
  invalidReason?: (v: WizardValue) => string | null;
}

const ALL_STEPS: StepDef[] = [
  {
    id: "canal",
    title: "Comment ce ticket est-il signalé ?",
    eyebrow: "Canal",
    subtitle: "Choisis le canal d'entrée du signalement.",
    isVisible: () => true,
    isValid: (v) => !!v.canal,
  },
  {
    id: "demandeur",
    title: "Qui a signalé ce problème ?",
    eyebrow: "Demandeur",
    subtitle: "Coordonnées pour pouvoir recontacter l'habitant.",
    isVisible: (v) => v.canal === "telephone" || v.canal === "email",
    isValid: (v) =>
      v.demandeur_nom.trim().length > 0 ||
      v.demandeur_telephone.trim().length > 0 ||
      v.demandeur_email.trim().length > 0,
    invalidReason: () => "Renseigne au moins un moyen de contact.",
  },
  {
    id: "categorie",
    title: "De quoi s'agit-il ?",
    eyebrow: "Catégorie",
    subtitle: "Sélectionne la catégorie qui correspond le mieux.",
    isVisible: () => true,
    isValid: (v) => !!v.categorieId,
    invalidReason: () => "Choisis une catégorie.",
  },
  {
    id: "periscolaire",
    title: "Précisions périscolaire",
    eyebrow: "Périscolaire",
    subtitle: "Lieu, moment et, si besoin, l'enfant concerné.",
    optional: true,
    isVisible: (v) => v.estPeriscolaire,
    isValid: (v) => v.enfant.trim().length <= 80,
    invalidReason: () => "Prénom et initiale suffisent (80 caractères au maximum).",
  },
  {
    id: "description",
    title: "Décris le problème",
    eyebrow: "Description",
    subtitle: "Un titre court suffit, la description est facultative.",
    isVisible: () => true,
    isValid: (v) => v.titre.trim().length >= 3,
    invalidReason: (v) =>
      v.titre.trim().length === 0
        ? "Le titre est obligatoire."
        : "Le titre doit faire au moins 3 caractères.",
  },
  {
    id: "priorite",
    title: "À quel point est-ce urgent ?",
    eyebrow: "Urgence",
    subtitle: "Indique le délai d'intervention attendu.",
    isVisible: () => true,
    isValid: (v) => !!v.urgence,
  },
  {
    id: "localisation",
    title: "Où exactement ?",
    eyebrow: "Localisation",
    subtitle: "GPS, adresse libre ou clic sur la carte.",
    isVisible: () => true,
    isValid: (v) => !!v.location.adresse?.trim() || v.location.latitude != null,
    invalidReason: () => "Indique une adresse ou un point GPS.",
  },
  {
    id: "photos",
    title: "Ajoute des photos",
    eyebrow: "Photos",
    subtitle: "Optionnel mais très utile pour l'agent technique.",
    optional: true,
    isVisible: () => true,
    isValid: () => true,
  },
  {
    id: "assignation",
    title: "Assigner à un agent ?",
    eyebrow: "Assignation",
    subtitle: "Tu peux confier ce ticket maintenant ou plus tard.",
    optional: true,
    isVisible: () => true,
    isValid: () => true,
  },
  {
    id: "visibilite",
    title: "Service et visibilité",
    eyebrow: "Visibilité",
    subtitle: "Par défaut, le signalement suit les règles de la commune.",
    isVisible: () => true,
    isValid: (v) => v.confidentialite === "standard" || v.destinataireIds.length > 0,
    invalidReason: () => "Choisis au moins une personne qui pourra voir ce signalement.",
  },
];

export const INITIAL_VALUE: WizardValue = {
  canal: "elu_terrain",
  demandeur_nom: "",
  demandeur_telephone: "",
  demandeur_email: "",
  demandeur_adresse: "",
  titre: "",
  description: "",
  categorieId: null,
  urgence: "normale",
  location: {
    latitude: null,
    longitude: null,
    adresse: null,
    precision_geo: null,
  },
  photoPaths: [],
  assigneIds: [],
  echeance: "",
  serviceId: "",
  confidentialite: "standard",
  destinataireIds: [],
  estPeriscolaire: false,
  siteId: "",
  creneau: "",
  enfant: "",
  familleInformee: "",
};

export interface UseTicketWizardResult {
  value: WizardValue;
  set: <K extends keyof WizardValue>(key: K, val: WizardValue[K]) => void;
  patch: (partial: Partial<WizardValue>) => void;
  steps: WizardStep[];
  current: number;
  currentStep: WizardStep;
  total: number;
  canNext: boolean;
  invalidReason: string | null;
  next: () => void;
  prev: () => void;
  goTo: (idx: number) => void;
  goToStep: (id: WizardStepId) => void;
  isDirty: boolean;
  isOnLastStep: boolean;
  isValidGlobal: boolean;
  /**
   * Sections visibles qui ne passent pas leur validation, avec leur
   * libellé et la raison concrète. Utile pour afficher 'Champs manquants'
   * sur le formulaire desktop quand le bouton de soumission est grisé.
   */
  missingSteps: Array<{ id: WizardStepId; eyebrow: string; reason: string | null }>;
}

export function useTicketWizard(initial?: Partial<WizardValue>): UseTicketWizardResult {
  const [value, setValue] = useState<WizardValue>({
    ...INITIAL_VALUE,
    ...initial,
  });
  const [current, setCurrent] = useState(0);

  const visibleSteps = useMemo(
    () => ALL_STEPS.filter((s) => s.isVisible(value)),
    [value],
  );

  const safeCurrent = Math.min(current, visibleSteps.length - 1);
  const currentStep = visibleSteps[safeCurrent];

  const canNext = currentStep ? currentStep.isValid(value) : false;
  const invalidReason =
    !canNext && currentStep?.invalidReason ? currentStep.invalidReason(value) : null;

  const isDirty = useMemo(() => {
    return (
      value.titre.trim().length > 0 ||
      value.description.trim().length > 0 ||
      value.categorieId != null ||
      value.photoPaths.length > 0 ||
      value.assigneIds.length > 0 ||
      value.location.adresse != null ||
      value.location.latitude != null ||
      value.demandeur_nom.length > 0 ||
      value.demandeur_telephone.length > 0 ||
      value.demandeur_email.length > 0
    );
  }, [value]);

  const set = useCallback<UseTicketWizardResult["set"]>((key, val) => {
    setValue((prev) => ({ ...prev, [key]: val }));
  }, []);

  const patch = useCallback((partial: Partial<WizardValue>) => {
    setValue((prev) => ({ ...prev, ...partial }));
  }, []);

  const next = useCallback(() => {
    setCurrent((c) => Math.min(c + 1, visibleSteps.length - 1));
  }, [visibleSteps.length]);

  const prev = useCallback(() => {
    setCurrent((c) => Math.max(c - 1, 0));
  }, []);

  const goTo = useCallback((idx: number) => {
    setCurrent(Math.max(0, idx));
  }, []);

  const goToStep = useCallback(
    (id: WizardStepId) => {
      const idx = visibleSteps.findIndex((s) => s.id === id);
      if (idx >= 0) setCurrent(idx);
    },
    [visibleSteps],
  );

  const isValidGlobal = useMemo(
    () => visibleSteps.every((s) => s.isValid(value)),
    [visibleSteps, value],
  );

  const missingSteps = useMemo(
    () =>
      visibleSteps
        .filter((s) => !s.isValid(value))
        .map((s) => ({
          id: s.id,
          eyebrow: s.eyebrow,
          reason: s.invalidReason ? s.invalidReason(value) : null,
        })),
    [visibleSteps, value],
  );

  return {
    value,
    set,
    patch,
    steps: visibleSteps,
    current: safeCurrent,
    currentStep,
    total: visibleSteps.length,
    canNext,
    invalidReason,
    next,
    prev,
    goTo,
    goToStep,
    isDirty,
    isOnLastStep: safeCurrent === visibleSteps.length - 1,
    isValidGlobal,
    missingSteps,
  };
}
