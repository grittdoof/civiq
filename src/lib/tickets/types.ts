// ═══════════════════════════════════════════════════════════════
// Types du module Tickets d'intervention
// Reflètent les enums + tables de supabase/migrations/010_*.sql
// ═══════════════════════════════════════════════════════════════

export type TicketPriorite = "basse" | "normale" | "haute" | "urgente";

export type TicketStatut =
  | "nouveau"
  | "assigne"
  | "pris_en_charge"
  | "en_cours"
  | "en_attente"
  | "resolu"
  | "clos"
  | "annule";

export type TicketCanal = "agent_interne" | "elu_terrain" | "email" | "telephone";

export type TicketCategorie =
  | "voirie"
  | "espaces_verts"
  | "batiment"
  | "eclairage_public"
  | "proprete"
  | "mobilier_urbain"
  | "reseaux_eau"
  | "signalisation"
  | "autre";

export type PhotoType = "signalement" | "service_fait" | "autre";

export interface Ticket {
  id: string;
  numero: number;
  commune_id: string;

  created_by: string | null;
  created_at: string;
  canal: TicketCanal;

  demandeur_nom: string | null;
  demandeur_telephone: string | null;
  demandeur_email: string | null;
  demandeur_adresse: string | null;

  titre: string;
  description: string | null;
  categorie: TicketCategorie;
  priorite: TicketPriorite;

  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  precision_geo: string | null;

  statut: TicketStatut;
  assigne_a: string | null;
  assigne_at: string | null;
  pris_en_charge_at: string | null;
  resolu_at: string | null;
  clos_at: string | null;
  clos_by: string | null;

  echeance: string | null;
  updated_at: string;
}

export interface TicketPhoto {
  id: string;
  ticket_id: string;
  storage_path: string;
  type: PhotoType;
  uploaded_by: string | null;
  uploaded_at: string;
  legende: string | null;
}

export interface TicketCommentaire {
  id: string;
  ticket_id: string;
  auteur_id: string | null;
  contenu: string;
  is_systeme: boolean;
  created_at: string;
}

export interface TicketRapport {
  id: string;
  ticket_id: string;
  redige_par: string | null;
  service_fait: boolean;
  description_intervention: string | null;
  duree_minutes: number | null;
  materiaux_utilises: string | null;
  cout_estime: number | null;
  necessite_suivi: boolean;
  notes_suivi: string | null;
  created_at: string;
}

// ─── Vue enrichie pour la liste / le détail ───
export interface TicketWithRelations extends Ticket {
  // Auteur du ticket (saisie outil)
  created_by_profile?: { id: string; full_name: string | null; job_title: string | null } | null;
  // Agent assigné
  assignee_profile?: { id: string; full_name: string | null; job_title: string | null } | null;
  // Comptage des photos / commentaires
  photo_count?: number;
  comment_count?: number;
  // Photos de signalement (les premières uniquement, optionnel)
  signalement_photos?: TicketPhoto[];
}

// ─── Constantes UI ───
export const PRIORITE_LABELS: Record<TicketPriorite, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
  urgente: "Urgente",
};

export const PRIORITE_COLORS: Record<TicketPriorite, { bg: string; fg: string }> = {
  basse: { bg: "oklch(0.95 0.005 258)", fg: "#6B7280" },
  normale: { bg: "oklch(0.95 0.05 258)", fg: "#3B82F6" },
  haute: { bg: "oklch(0.96 0.06 60)", fg: "#F59E0B" },
  urgente: { bg: "oklch(0.95 0.07 25)", fg: "#EF4444" },
};

export const STATUT_LABELS: Record<TicketStatut, string> = {
  nouveau: "Nouveau",
  assigne: "Assigné",
  pris_en_charge: "Pris en charge",
  en_cours: "En cours",
  en_attente: "En attente",
  resolu: "Résolu",
  clos: "Clos",
  annule: "Annulé",
};

export const STATUT_COLORS: Record<TicketStatut, { bg: string; fg: string }> = {
  nouveau: { bg: "oklch(0.95 0.06 258)", fg: "var(--accent)" },
  assigne: { bg: "oklch(0.95 0.05 258)", fg: "#3B82F6" },
  pris_en_charge: { bg: "oklch(0.95 0.06 200)", fg: "#0891B2" },
  en_cours: { bg: "oklch(0.96 0.06 60)", fg: "#F59E0B" },
  en_attente: { bg: "oklch(0.95 0.04 280)", fg: "#7C3AED" },
  resolu: { bg: "oklch(0.95 0.06 155)", fg: "var(--success)" },
  clos: { bg: "oklch(0.93 0.005 258)", fg: "#6B7280" },
  annule: { bg: "oklch(0.93 0.01 25)", fg: "#9CA3AF" },
};

export const CATEGORIE_LABELS: Record<TicketCategorie, string> = {
  voirie: "Voirie",
  espaces_verts: "Espaces verts",
  batiment: "Bâtiments",
  eclairage_public: "Éclairage public",
  proprete: "Propreté",
  mobilier_urbain: "Mobilier urbain",
  reseaux_eau: "Réseaux d'eau",
  signalisation: "Signalisation",
  autre: "Autre",
};

export const CATEGORIE_ICONS: Record<TicketCategorie, string> = {
  voirie: "🛣️",
  espaces_verts: "🌳",
  batiment: "🏛️",
  eclairage_public: "💡",
  proprete: "🧹",
  mobilier_urbain: "🪑",
  reseaux_eau: "💧",
  signalisation: "🚦",
  autre: "📋",
};

// ─── Cycle de vie simplifié ───
// L'UI ne montre que 2 états : Ouvert / Clôturé. Le DB conserve
// l'enum complet pour la rétrocompatibilité et le wizard de clôture.

export type TicketGroup = "ouvert" | "cloture";

export const STATUT_GROUP: Record<TicketStatut, TicketGroup> = {
  nouveau: "ouvert",
  assigne: "ouvert",
  pris_en_charge: "ouvert",
  en_cours: "ouvert",
  en_attente: "ouvert",
  resolu: "cloture",
  clos: "cloture",
  annule: "cloture",
};

export const OUVERT_STATUTS: TicketStatut[] = [
  "nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente",
];
export const CLOTURE_STATUTS: TicketStatut[] = ["resolu", "clos", "annule"];

export const GROUP_LABELS: Record<TicketGroup, string> = {
  ouvert: "Ouvert",
  cloture: "Clôturé",
};

export const GROUP_COLORS: Record<TicketGroup, { bg: string; fg: string }> = {
  ouvert: { bg: "oklch(0.95 0.06 258)", fg: "var(--accent)" },
  cloture: { bg: "oklch(0.95 0.06 155)", fg: "var(--success)" },
};

export function groupOf(statut: TicketStatut): TicketGroup {
  return STATUT_GROUP[statut];
}

export const CANAL_LABELS: Record<TicketCanal, string> = {
  agent_interne: "Agent municipal",
  elu_terrain: "Élu sur le terrain",
  email: "Email",
  telephone: "Téléphone",
};
