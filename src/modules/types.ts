// ═══════════════════════════════════════════════════════════════
// MODULE DEFINITION — Contrat d'un module GoCiviQ
//
// Chaque module de la plateforme (sondages, budget, événements…)
// exporte une ModuleDefinition qui décrit :
//   - son identité (key, nom, icône)
//   - les entrées de navigation qu'il ajoute à l'admin
//   - les chemins d'URL qu'il possède (gating)
//   - son état (stable/beta/coming_soon)
//
// Le registre (src/modules/registry.ts) agrège toutes les
// définitions et fournit des helpers pour l'admin layout + le
// guard serveur.
// ═══════════════════════════════════════════════════════════════

import type { LucideIcon } from "lucide-react";

export type ModuleStatus = "stable" | "beta" | "coming_soon";

export interface ModuleNavItem {
  /** URL absolue (ex: /admin/surveys) */
  href: string;
  /** Libellé affiché dans la sidebar */
  label: string;
  /** Icône lucide-react */
  icon: LucideIcon;
  /** true = match exact ; false = match préfixe */
  exact?: boolean;
  /** Si true, visible uniquement pour les rôles admin+ (pas editor) */
  adminOnly?: boolean;
}

export interface ModuleDefinition {
  /** Clé unique (doit matcher public.modules.id en BDD) */
  key: string;
  /** Nom affiché */
  name: string;
  /** Description courte (fallback de la BDD) */
  tagline: string;
  /** Icône principale du module (utilisée dans le catalogue) */
  icon: LucideIcon;
  /** Statut de release */
  status: ModuleStatus;
  /** Entrées ajoutées à la sidebar `/admin` quand le module est actif */
  adminNav: ModuleNavItem[];
  /**
   * Chemins (prefixes) que ce module possède dans l'app.
   * Utilisé par `requireModule()` pour bloquer l'accès si le module
   * n'est pas activé pour la commune de l'utilisateur.
   * Ex : ["/admin/surveys", "/api/surveys"]
   */
  ownedPaths: string[];
}
