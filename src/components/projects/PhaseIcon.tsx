import {
  Lightbulb, Search, Landmark, Wallet, Ruler, HardHat, Flag,
  type LucideIcon,
} from "lucide-react";
import type { ProjectPhase } from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// Mapping phase → composant Lucide. Centralisé pour éviter le
// switch dans chaque composant qui affiche une phase.
// ═══════════════════════════════════════════════════════════════

const ICONS: Record<ProjectPhase, LucideIcon> = {
  emergence: Lightbulb,
  faisabilite: Search,
  decision_budget: Landmark,
  financement: Wallet,
  conception_marches: Ruler,
  realisation: HardHat,
  bilan_cloture: Flag,
};

interface Props {
  phase: ProjectPhase;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function PhaseIcon({ phase, size = 16, strokeWidth = 1.75, className }: Props) {
  const Icon = ICONS[phase];
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}
