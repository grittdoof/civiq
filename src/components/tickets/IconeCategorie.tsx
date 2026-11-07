import {
  Armchair, Building2, CircleHelp, Droplets, FileText, Flower2, Lightbulb, Monitor,
  PawPrint, Route, School, Shield, Tent, Trash2, Trees, Wifi, type LucideIcon,
} from "lucide-react";

// Icônes des catégories de signalements (lot 2). Le nom est stocké en
// base (`ticket_categories.icone`) ; un nom inconnu affiche « ? ».
const ICONES: Record<string, LucideIcon> = {
  route: Route,
  lightbulb: Lightbulb,
  "trash-2": Trash2,
  trees: Trees,
  "paw-print": PawPrint,
  droplets: Droplets,
  "building-2": Building2,
  wifi: Wifi,
  armchair: Armchair,
  "flower-2": Flower2,
  shield: Shield,
  school: School,
  tent: Tent,
  monitor: Monitor,
  "file-text": FileText,
  "circle-help": CircleHelp,
};

export const NOMS_ICONES = Object.keys(ICONES);

export default function IconeCategorie({ nom, size = 20 }: { nom: string | null | undefined; size?: number }) {
  const Icone = (nom && ICONES[nom]) || CircleHelp;
  return <Icone size={size} aria-hidden="true" />;
}
