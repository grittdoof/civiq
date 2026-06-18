import {
  FolderKanban,
  LayoutGrid,
  Plus,
  BarChart3,
  Users,
  CalendarDays,
  Gavel,
} from "lucide-react";
import type { ModuleDefinition } from "../types";

// ═══════════════════════════════════════════════════════════════
// MODULE : Gestion de projet (beta)
//
// Pages    : src/app/admin/projects/**, src/app/admin/commissions/**
// API      : src/app/api/projects/**, src/app/api/commissions/**
// Schéma   : supabase/migrations/017_projects_module.sql
//
// Réservé aux élus/agents (admin, editor, super_admin). Aucun
// accès viewer/citoyen.
// ═══════════════════════════════════════════════════════════════

export const projectsModule: ModuleDefinition = {
  key: "projects",
  name: "Gestion de projet",
  tagline: "Pilotez vos projets d'investissement sur leur cycle de vie complet",
  icon: FolderKanban,
  status: "beta",
  adminNav: [
    {
      href: "/admin/projects",
      label: "Projets",
      icon: LayoutGrid,
      exact: true,
    },
    {
      href: "/admin/projects/nouveau",
      label: "Nouveau projet",
      icon: Plus,
      exact: true,
    },
    {
      href: "/admin/projects/comparatif",
      label: "Comparatif coûts",
      icon: BarChart3,
      exact: true,
    },
    {
      href: "/admin/projects/cartographie",
      label: "Parties prenantes",
      icon: Users,
      exact: true,
    },
    {
      href: "/admin/projects/revue-mensuelle",
      label: "Revue mensuelle",
      icon: CalendarDays,
      exact: true,
    },
    {
      href: "/admin/commissions",
      label: "Commissions",
      icon: Gavel,
      exact: true,
    },
  ],
  ownedPaths: [
    "/admin/projects",
    "/admin/commissions",
    "/api/projects",
    "/api/commissions",
  ],
};
