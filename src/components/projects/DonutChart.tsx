"use client";

import { useState, useId, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// DonutChart — camembert (donut) SVG sans dépendance.
//
// UX :
//   - chaque segment a une couleur + label
//   - hover → segment légèrement décalé vers l'extérieur,
//     tooltip avec valeur formatée + pourcentage
//   - clic optionnel pour drill-down
// ═══════════════════════════════════════════════════════════════

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutSlice[];
  size?: number;
  /** Largeur du trait (épaisseur du donut) */
  stroke?: number;
  /** Formatage des valeurs dans le tooltip */
  formatValue?: (n: number) => string;
  /** Texte central (ex : total) */
  centerLabel?: string;
  centerValue?: string;
}

export default function DonutChart({
  data,
  size = 220,
  stroke = 26,
  formatValue = (n) => n.toLocaleString("fr-FR"),
  centerLabel,
  centerValue,
}: Props) {
  const gid = useId();
  const [hover, setHover] = useState<string | null>(null);

  const total = useMemo(() => data.reduce((s, d) => s + Math.max(0, d.value), 0), [data]);
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Calcul des arcs : on convertit en angles (radians)
  // et on génère des paths SVG. Petit gap visuel entre chaque segment.
  const slices = useMemo(() => {
    if (total === 0) return [];
    let cumulative = 0;
    const gap = data.length > 1 ? 0.015 : 0; // 1.5% du tour pour le gap
    const totalGap = gap * data.length;
    return data
      .map((d) => {
        if (d.value <= 0) return null;
        const pct = d.value / total;
        const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
        cumulative += pct;
        const endAngle = cumulative * 2 * Math.PI - Math.PI / 2 - gap;
        // si total des gaps trop grand on les ignore
        const safeEnd = totalGap < 1 ? endAngle : startAngle + pct * 2 * Math.PI - Math.PI / 2;
        return {
          ...d,
          pct,
          path: arcPath(cx, cy, radius, startAngle, safeEnd),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [data, total, cx, cy, radius]);

  const hovered = hover ? slices.find((s) => s.id === hover) : null;

  if (total === 0) {
    return (
      <div className="pj-donut-empty">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--civiq-border, #e8e5de)"
            strokeWidth={stroke}
          />
        </svg>
        <p className="pj-donut-empty-text">Aucune donnée à représenter</p>
      </div>
    );
  }

  return (
    <div className="pj-donut">
      <div className="pj-donut-svg-wrap">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="pj-donut-svg"
          role="img"
          aria-labelledby={`${gid}-title`}
        >
          <title id={`${gid}-title`}>
            Répartition — {data.length} catégorie{data.length > 1 ? "s" : ""}
          </title>
          <g>
            {slices.map((s) => (
              <path
                key={s.id}
                d={s.path}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeLinecap="butt"
                className={`pj-donut-slice${hover === s.id ? " is-hovered" : ""}`}
                onMouseEnter={() => setHover(s.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(s.id)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  cursor: "pointer",
                }}
              />
            ))}
          </g>
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="pj-donut-center-value"
          >
            {hovered
              ? Math.round(hovered.pct * 100) + " %"
              : centerValue ?? formatValue(total)}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="pj-donut-center-label"
          >
            {hovered ? hovered.label : centerLabel ?? "Total"}
          </text>
        </svg>
      </div>

      <ul className="pj-donut-legend" aria-label="Légende du graphique">
        {slices.map((s) => (
          <li
            key={s.id}
            className={`pj-donut-legend-item${hover === s.id ? " is-hovered" : ""}`}
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="pj-donut-legend-swatch"
              style={{ background: s.color }}
              aria-hidden
            />
            <span className="pj-donut-legend-label">{s.label}</span>
            <span className="pj-donut-legend-value">
              {formatValue(s.value)}
              <span className="pj-donut-legend-pct">{" "}· {Math.round(s.pct * 100)} %</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Helper : génère le path SVG d'un arc de cercle.
function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}
