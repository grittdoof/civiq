import { Building2 } from "lucide-react";
import type { ModuleDefinition } from "../types";

export const urbanismModule: ModuleDefinition = {
  key: "urbanism",
  name: "Concertations urbanisme",
  tagline: "Recueillez les avis sur les projets urbains",
  icon: Building2,
  status: "coming_soon",
  adminNav: [],
  ownedPaths: ["/admin/urbanism", "/api/urbanism"],
};
