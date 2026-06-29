import {
  Lightbulb, Search, Landmark, Wallet, Ruler, HardHat, Flag,
  ShieldCheck, Truck, PartyPopper, ListChecks,
  type LucideIcon,
} from "lucide-react";
import type { ProjectPhase } from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// Mapping phase → composant Lucide. Centralisé pour éviter le
// switch dans chaque composant qui affiche une phase.
// ═══════════════════════════════════════════════════════════════

const ICONS: Record<ProjectPhase, LucideIcon> = {
  // investment
  emergence: Lightbulb,
  faisabilite: Search,
  decision_budget: Landmark,
  financement: Wallet,
  conception_marches: Ruler,
  realisation: HardHat,
  bilan_cloture: Flag,
  // event
  event_framing: Lightbulb,
  event_authorizations: ShieldCheck,
  event_logistics: Truck,
  event_dday: PartyPopper,
  event_review: Flag,
  // tracking
  tracking_framing: Lightbulb,
  tracking_execution: ListChecks,
  tracking_review: Flag,
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
