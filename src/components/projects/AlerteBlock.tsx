import type { ReactNode } from "react";
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import LearnMore from "./LearnMore";
import type { Alerte } from "@/lib/projects/type-change";

// ═══════════════════════════════════════════════════════════════
// Structure imposée des alertes (doctrine, règle n°3) :
//   1. Ce qui se passe  2. Pourquoi c'est un problème
//   3. Ce qu'il faut faire  — puis « En savoir plus » (juridique) replié.
// Registre explicite (règle n°4) : obligatoire / recommandé / information.
// ═══════════════════════════════════════════════════════════════

export type Registre = "obligatoire" | "recommande" | "information";

const REGISTRE_META: Record<Registre, { label: string; Icon: typeof Info; className: string }> = {
  obligatoire: { label: "Obligatoire", Icon: AlertTriangle, className: "pj-alerte-obligatoire" },
  recommande: { label: "Recommandé", Icon: Lightbulb, className: "pj-alerte-recommande" },
  information: { label: "Pour information", Icon: Info, className: "pj-alerte-information" },
};

interface Props {
  alerte: Alerte;
  registre?: Registre;
  enSavoirPlus?: ReactNode;
  role?: "alert" | "status";
}

export default function AlerteBlock({ alerte, registre = "obligatoire", enSavoirPlus, role = "status" }: Props) {
  const meta = REGISTRE_META[registre];
  const { Icon } = meta;
  return (
    <div className={`pj-alerte ${meta.className}`} role={role}>
      <p className="pj-alerte-registre">
        <Icon size={14} aria-hidden="true" /> {meta.label}
      </p>
      <p className="pj-alerte-constat">{alerte.constat}</p>
      <p className="pj-alerte-consequence">{alerte.consequence}</p>
      {alerte.actions.length > 0 && (
        <ul className="pj-alerte-actions">
          {alerte.actions.map((a) => (
            <li key={a}>→ {a}</li>
          ))}
        </ul>
      )}
      {enSavoirPlus ? <LearnMore>{enSavoirPlus}</LearnMore> : null}
    </div>
  );
}
