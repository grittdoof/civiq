"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { formatEuros } from "@/lib/projects/cost-calc";

interface Row {
  id: string;
  titre: string;
  invest: number;
  total_nominal: number;
  total_actualise: number;
}

interface Props {
  rows: Row[];
}

// Graphe invest vs global actualisé — démontre les inversions
// (un projet « pas cher » à l'investissement peut être le plus
// coûteux sur 10 ans).
export default function CostComparisonChart({ rows }: Props) {
  const data = rows.slice(0, 12).map((r) => ({
    name: r.titre.length > 18 ? r.titre.slice(0, 18) + "…" : r.titre,
    Investissement: Math.round(r.invest),
    "Coût global actualisé": Math.round(r.total_actualise),
  }));
  return (
    <div style={{ width: "100%", height: 340 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--civiq-border)" />
          <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} fontSize={11} />
          <YAxis tickFormatter={(v) => formatEuros(v as number)} fontSize={11} />
          <Tooltip
            formatter={(v) => formatEuros(v as number)}
            contentStyle={{
              background: "var(--civiq-surface)",
              border: "1px solid var(--civiq-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Investissement" fill="#5a8dff">
            {data.map((_, i) => <Cell key={i} />)}
          </Bar>
          <Bar dataKey="Coût global actualisé" fill="#ff5a5f">
            {data.map((_, i) => <Cell key={i} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
