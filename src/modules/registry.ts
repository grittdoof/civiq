// ═══════════════════════════════════════════════════════════════
// MODULE REGISTRY — Point d'entrée unique
//
// Pour ajouter un nouveau module :
//   1. Créer un dossier src/modules/<key>/
//   2. Exporter une ModuleDefinition depuis <key>/index.ts
//   3. L'importer et l'ajouter à MODULES ci-dessous
//   4. Insérer une ligne correspondante dans public.modules (SQL)
// ═══════════════════════════════════════════════════════════════

import type { ModuleDefinition, ModuleNavItem } from "./types";
import { surveysModule } from "./surveys";
import { budgetModule } from "./budget";
import { eventsModule } from "./events";
import { alertsModule } from "./alerts";
import { urbanismModule } from "./urbanism";

export const MODULES: ModuleDefinition[] = [
  surveysModule,
  budgetModule,
  eventsModule,
  alertsModule,
  urbanismModule,
];

export const MODULES_BY_KEY: Record<string, ModuleDefinition> = MODULES.reduce(
  (acc, m) => {
    acc[m.key] = m;
    return acc;
  },
  {} as Record<string, ModuleDefinition>
);

/** Retourne les définitions des modules activés pour la commune courante */
export function getActiveModules(activeKeys: string[]): ModuleDefinition[] {
  const set = new Set(activeKeys);
  return MODULES.filter((m) => set.has(m.key));
}

/** Aplatit les entrées de navigation des modules activés */
export function getAdminNavForModules(activeKeys: string[]): ModuleNavItem[] {
  return getActiveModules(activeKeys).flatMap((m) => m.adminNav);
}

/**
 * Trouve le module qui "possède" un chemin donné.
 * Ex: "/admin/surveys/123" → surveysModule
 * Retourne null si aucun module ne revendique ce chemin (route commune).
 */
export function findModuleForPath(pathname: string): ModuleDefinition | null {
  for (const m of MODULES) {
    for (const owned of m.ownedPaths) {
      if (pathname === owned || pathname.startsWith(owned + "/")) {
        return m;
      }
    }
  }
  return null;
}
