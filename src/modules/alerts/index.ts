import { Bell } from "lucide-react";
import type { ModuleDefinition } from "../types";

export const alertsModule: ModuleDefinition = {
  key: "alerts",
  name: "Alertes citoyens",
  tagline: "Notifications push et SMS",
  icon: Bell,
  status: "coming_soon",
  adminNav: [],
  ownedPaths: ["/admin/alerts", "/api/alerts"],
};
