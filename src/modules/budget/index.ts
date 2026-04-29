import { PiggyBank, LayoutDashboard, Plus } from "lucide-react";
import type { ModuleDefinition } from "../types";

// ═══════════════════════════════════════════════════════════════
// MODULE : Budget participatif (beta)
//
// Pages : src/app/admin/budget/**
// API   : src/app/api/budget/** (à venir)
// ═══════════════════════════════════════════════════════════════

export const budgetModule: ModuleDefinition = {
  key: "budget",
  name: "Budget participatif",
  tagline: "Donnez la parole aux citoyens sur le budget",
  icon: PiggyBank,
  status: "beta",
  adminNav: [
    {
      href: "/admin/budget",
      label: "Budget participatif",
      icon: PiggyBank,
      exact: true,
    },
    {
      href: "/admin/budget/new",
      label: "Nouvelle enveloppe",
      icon: Plus,
      exact: true,
    },
  ],
  ownedPaths: ["/admin/budget", "/api/budget"],
};

// Exporte aussi l'icône pour réutilisation dans les pages du module
export { LayoutDashboard };
