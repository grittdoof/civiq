"use client";

import { useEffect, useState, type ComponentType } from "react";

// Jauge chargée en différé : recharts (~100 ko) n'alourdit pas le premier
// affichage de l'écran de vie (mobile, 4G en campagne). En attendant — ou
// si le chargement échoue — la valeur est déjà lisible en texte.

interface Props {
  label: string;
  pct: number | null;
  hint?: string;
  color?: string;
}

function Fallback({ label, pct, hint }: Props) {
  const text = pct === null ? "non renseigné" : `${Math.round(pct)} %`;
  return (
    <figure className="pj-gauge">
      <div className="pj-gauge-chart" style={{ width: 96, height: 96 }} aria-hidden="true">
        <span className={pct === null ? "pj-gauge-value pj-gauge-value-empty" : "pj-gauge-value"}>
          {pct === null ? "—" : text}
        </span>
      </div>
      <figcaption className="pj-gauge-caption">
        <span className="pj-gauge-label">{label}</span>
        <span className="pj-gauge-text">{text}</span>
        {hint ? <span className="pj-gauge-hint">{hint}</span> : null}
      </figcaption>
    </figure>
  );
}

export default function GaugeLazy(props: Props) {
  const [Gauge, setGauge] = useState<ComponentType<Props> | null>(null);
  useEffect(() => {
    let alive = true;
    import("./Gauge").then((m) => { if (alive) setGauge(() => m.default); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return Gauge ? <Gauge {...props} /> : <Fallback {...props} />;
}
