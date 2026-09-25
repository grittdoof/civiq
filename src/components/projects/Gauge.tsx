"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

// Jauge circulaire (brief §2.6) — recharts, couleurs du design system.
// La valeur est toujours écrite en texte (et « non renseigné » quand elle
// n'existe pas) : le graphique ne porte jamais l'information seul.

interface Props {
  label: string;
  pct: number | null;
  hint?: string;
  size?: number;
  color?: string;
}

export default function Gauge({ label, pct, hint, size = 96, color = "var(--accent)" }: Props) {
  const value = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const text = pct === null ? "non renseigné" : `${Math.round(value)} %`;
  return (
    <figure className="pj-gauge" style={{ ["--gauge-color" as string]: color }}>
      <div className="pj-gauge-chart" style={{ width: size, height: size }} aria-hidden="true">
        <RadialBarChart
          width={size}
          height={size}
          innerRadius="78%"
          outerRadius="100%"
          data={[{ value }]}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          {/* Couleurs via CSS (.pj-gauge …) : l'attribut SVG fill ne résout pas var(--token). */}
          <RadialBar dataKey="value" background cornerRadius={8} isAnimationActive={false} />
        </RadialBarChart>
        <span className={pct === null ? "pj-gauge-value pj-gauge-value-empty" : "pj-gauge-value"}>
          {pct === null ? "—" : `${Math.round(value)} %`}
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
