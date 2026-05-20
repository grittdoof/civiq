import { Wrench, LayoutGrid, Plus, Map as MapIcon, BarChart3 } from "lucide-react";
import type { ModuleDefinition } from "../types";

// ═══════════════════════════════════════════════════════════════
// MODULE : Tickets d'intervention (beta)
//
// Pages    : src/app/admin/tickets/**
// API      : src/app/api/tickets/** (à venir Session 2-4)
// Schéma   : supabase/migrations/010_tickets_module.sql
// ═══════════════════════════════════════════════════════════════

export const ticketsModule: ModuleDefinition = {
  key: "tickets",
  name: "Tickets d'intervention",
  tagline: "Pilotez les signalements et interventions techniques de la commune",
  icon: Wrench,
  status: "beta",
  adminNav: [
    {
      href: "/admin/tickets",
      label: "Tickets",
      icon: LayoutGrid,
      exact: true,
    },
    {
      href: "/admin/tickets/nouveau",
      label: "Nouveau ticket",
      icon: Plus,
      exact: true,
    },
    {
      href: "/admin/tickets/carte",
      label: "Carte",
      icon: MapIcon,
      exact: true,
    },
    {
      href: "/admin/tickets/stats",
      label: "Stats",
      icon: BarChart3,
      exact: true,
    },
  ],
  ownedPaths: ["/admin/tickets", "/api/tickets"],
};
