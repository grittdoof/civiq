import { ClipboardList, LayoutDashboard, Plus } from "lucide-react";
import type { ModuleDefinition } from "../types";

// ═══════════════════════════════════════════════════════════════
// MODULE : Sondages citoyens
//
// Code existant :
//   - Admin  : src/app/admin/surveys/**
//   - Public : src/app/survey/[slug]/**
//   - API    : src/app/api/surveys/**, src/app/api/responses/**,
//              src/app/api/export/**
//   - UI     : src/components/survey/**
//
// Ce fichier ne déplace pas le code ; il déclare au registre que
// le module "surveys" possède ces routes et ajoute les entrées de
// nav correspondantes.
// ═══════════════════════════════════════════════════════════════

export const surveysModule: ModuleDefinition = {
  key: "surveys",
  name: "Sondages citoyens",
  tagline: "Consultez vos administrés en quelques clics",
  icon: ClipboardList,
  status: "stable",
  adminNav: [
    {
      href: "/admin/dashboard",
      label: "Tableau de bord",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: "/admin/surveys/new",
      label: "Nouveau sondage",
      icon: Plus,
      exact: true,
    },
  ],
  ownedPaths: [
    "/admin/dashboard",
    "/admin/surveys",
    "/survey",
    "/api/surveys",
    "/api/responses",
    "/api/export",
  ],
};
