// ═══════════════════════════════════════════════════════════════
// Design tokens du module Tickets — direction Airbnb + identité GoCiviq.
// Mappe les types DB réels (TicketCategorie, TicketPriorite, TicketStatut)
// vers les couleurs, icônes et labels du prototype Claude Design.
// ═══════════════════════════════════════════════════════════════

import type {
  TicketCategorie,
  TicketPriorite,
  TicketStatut,
} from "@/lib/tickets/types";

// ─── Palette ────────────────────────────────────────────────────
export const TK = {
  marine: "#042F64",
  azur: "#2F6FDB",
  rouge: "#E00114",
  rougeDark: "#C1121F",
  ink: "#0A0E1A",
  ink2: "#3F4150",
  muted: "#717280",
  line: "#EBECEF",
  bg: "#FFFFFF",
  bg2: "#F7F7F7",
  success: "#15803D",
} as const;

// ─── Catégories ────────────────────────────────────────────────
export interface CategorieConfig {
  label: string;
  icon: string;
  color: string;
}

export const TK_CATEGORIES: Record<TicketCategorie, CategorieConfig> = {
  voirie: { label: "Voirie", icon: "🛣️", color: "#1E40AF" },
  eclairage_public: { label: "Éclairage public", icon: "💡", color: "#A16207" },
  proprete: { label: "Propreté", icon: "🧹", color: "#15803D" },
  espaces_verts: { label: "Espaces verts", icon: "🌳", color: "#166534" },
  batiment: { label: "Bâtiments", icon: "🏛️", color: "#7C2D12" },
  mobilier_urbain: { label: "Mobilier urbain", icon: "🪑", color: "#6B21A8" },
  reseaux_eau: { label: "Réseaux & eau", icon: "💧", color: "#0E7490" },
  signalisation: { label: "Signalisation", icon: "🚦", color: "#B91C1C" },
  autre: { label: "Autre", icon: "📌", color: "#475569" },
};

// ─── Priorités ─────────────────────────────────────────────────
export interface PrioriteConfig {
  label: string;
  color: string;
  hint: string;
}

export const TK_PRIORITES: Record<TicketPriorite, PrioriteConfig> = {
  basse: { label: "Basse", color: "#16A34A", hint: "À traiter quand possible" },
  normale: { label: "Normale", color: "#2F6FDB", hint: "Délai standard" },
  haute: { label: "Haute", color: "#EA580C", hint: "Sous 48 h" },
  urgente: { label: "Urgente", color: "#E00114", hint: "Sécurité publique" },
};

// ─── Statuts (regroupés en 3 familles pour l'UI mobile) ────────
export type StatutFamily = "en_cours" | "cloture" | "annule";

export interface StatutConfig {
  label: string;
  color: string;
  bg: string;
  family: StatutFamily;
}

export const TK_STATUTS: Record<TicketStatut, StatutConfig> = {
  nouveau: { label: "Nouveau", color: "#1D4ED8", bg: "#EBF5FF", family: "en_cours" },
  assigne: { label: "Assigné", color: "#1D4ED8", bg: "#EBF5FF", family: "en_cours" },
  pris_en_charge: { label: "Pris en charge", color: "#1D4ED8", bg: "#EBF5FF", family: "en_cours" },
  en_cours: { label: "En cours", color: "#1D4ED8", bg: "#EBF5FF", family: "en_cours" },
  en_attente: { label: "En attente", color: "#A16207", bg: "#FEF3C7", family: "en_cours" },
  resolu: { label: "Résolu", color: "#15803D", bg: "#F0FDF4", family: "cloture" },
  clos: { label: "Clôturé", color: "#15803D", bg: "#F0FDF4", family: "cloture" },
  annule: { label: "Annulé", color: "#6B7080", bg: "#F2F3F7", family: "annule" },
};

// ─── Canaux ─────────────────────────────────────────────────────
export const TK_CANAUX = {
  elu_terrain: { label: "Élu terrain", sub: "Repéré sur le terrain" },
  agent_interne: { label: "Agent interne", sub: "Signalé en interne" },
  telephone: { label: "Téléphone", sub: "Appel d'un habitant" },
  email: { label: "Email", sub: "Reçu par mail" },
} as const;

// ─── Couleurs d'avatar par hash de nom ─────────────────────────
const AVATAR_PALETTE = [
  "#042F64", // marine
  "#2F6FDB", // azur
  "#15803D",
  "#B91C1C",
  "#7C2D12",
  "#A16207",
  "#6B21A8",
  "#0E7490",
];

export function avatarColorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
