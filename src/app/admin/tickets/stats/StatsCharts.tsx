"use client";

import dynamic from "next/dynamic";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { PRIORITE_COLORS, type TicketPriorite } from "@/lib/tickets/types";

// Heatmap chargée dynamiquement (Leaflet ne fonctionne pas SSR)
const HeatmapMap = dynamic(() => import("./HeatmapMap"), {
  ssr: false,
  loading: () => <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>Chargement de la carte…</p>,
});

interface Props {
  weekly: { week: string; count: number }[];
  categorieData: { name: string; value: number }[];
  prioriteData: { name: string; value: number }[];
  topAgents: { id: string; name: string; closedCount: number }[];
  geoPoints: { lat: number; lng: number; weight: number }[];
}

const CATEGORIE_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6B7280",
];

const PRIO_PALETTE: TicketPriorite[] = ["basse", "normale", "haute", "urgente"];

export default function StatsCharts({
  weekly, categorieData, prioriteData, topAgents, geoPoints,
}: Props) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* Tickets par semaine */}
      <Card title="Tickets créés par semaine" subtitle="12 dernières semaines">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={weekly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--fg-muted)" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--fg-muted)" }} width={28} />
            <Tooltip
              contentStyle={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 8, fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--accent)" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
        {/* Pie catégories */}
        <Card title="Répartition par catégorie">
          {categorieData.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={categorieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  innerRadius={48} outerRadius={86}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                  labelLine={false}
                  fontSize={11}
                >
                  {categorieData.map((_, i) => (
                    <Cell key={i} fill={CATEGORIE_COLORS[i % CATEGORIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Bar priorités */}
        <Card title="Répartition par priorité">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={prioriteData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--fg-muted)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--fg-muted)" }} width={28} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {prioriteData.map((_, i) => (
                  <Cell key={i} fill={PRIORITE_COLORS[PRIO_PALETTE[i]].fg} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top agents */}
      <Card title="Top 5 agents par tickets résolus" subtitle="Tous statuts résolus / clos confondus">
        {topAgents.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {topAgents.map((a, i) => {
              const max = Math.max(...topAgents.map((x) => x.closedCount));
              const pct = (a.closedCount / max) * 100;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: "var(--fg)", fontWeight: 500 }}>{a.name}</span>
                      <span style={{ color: "var(--fg-muted)", fontWeight: 600 }}>{a.closedCount}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--border-light)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", borderRadius: 99 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Heatmap géographique */}
      <Card title="Heatmap des zones d'intervention" subtitle="Densité des tickets sur la commune">
        {geoPoints.length === 0 ? (
          <Empty msg="Pas encore de tickets géolocalisés." />
        ) : (
          <HeatmapMap points={geoPoints} />
        )}
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="civiq-card" style={{ padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", letterSpacing: "-0.01em" }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ msg = "Pas encore de données." }: { msg?: string }) {
  return (
    <p style={{ fontSize: 13, color: "var(--fg-muted)", textAlign: "center", padding: 30 }}>{msg}</p>
  );
}
