import { HardHat, ListChecks, PartyPopper } from "lucide-react";
import type { TypeProjetCode } from "@/lib/projects/types";

// Badge de type de projet : couleur + icône + libellé (jamais la couleur
// seule). Mêmes repères dans la liste, l'écran de vie et le calendrier.

export const TYPE_META: Record<TypeProjetCode, { label: string; Icon: typeof HardHat; cssVar: string }> = {
  investissement: { label: "Investissement", Icon: HardHat, cssVar: "investment" },
  evenementiel: { label: "Événement", Icon: PartyPopper, cssVar: "event" },
  suivi_simple: { label: "Suivi simple", Icon: ListChecks, cssVar: "tracking" },
};

export default function TypeBadge({ type, size = "md" }: { type: TypeProjetCode | null | undefined; size?: "sm" | "md" }) {
  const meta = TYPE_META[type ?? "suivi_simple"];
  const { Icon } = meta;
  return (
    <span className={`pj-type-badge pj-type-badge-${meta.cssVar} pj-type-badge-${size}`}>
      <Icon size={size === "sm" ? 12 : 14} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
