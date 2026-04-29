import { CalendarDays } from "lucide-react";
import type { ModuleDefinition } from "../types";

export const eventsModule: ModuleDefinition = {
  key: "events",
  name: "Événements municipaux",
  tagline: "Inscriptions et gestion des événements",
  icon: CalendarDays,
  status: "coming_soon",
  adminNav: [],
  ownedPaths: ["/admin/events", "/api/events"],
};
