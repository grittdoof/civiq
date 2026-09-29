"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Statistiques } from "@/lib/projects/pilotage";

// Graphiques de l'onglet Statistiques (chargés en différé).
// Couleurs : classes CSS (.pj-stats-serie-*) — l'attribut SVG `fill`
// ne résout pas les variables CSS du design system.

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur = (n: number) => EUR.format(n);
const kEur = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 1000).toLocaleString("fr-FR")} k€` : `${n} €`);

export function AvancementChart({ lignes }: { lignes: Statistiques["parCommission"] }) {
  const data = lignes.map((l) => ({ nom: l.nom, avancement: l.avancement ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 42 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v} %`} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="nom" width={140} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => [`${v} %`, "Avancement moyen"]} />
        <Bar isAnimationActive={false} dataKey="avancement" name="Avancement moyen" className="pj-stats-serie-accent" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BudgetChart({ lignes }: { lignes: Statistiques["parCommission"] }) {
  const data = lignes.map((l) => ({ nom: l.nom, prevu: l.prevuHt, engage: l.engageHt, mandate: l.mandateHt }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="nom" tick={{ fontSize: 12 }} interval={0} />
        <YAxis tickFormatter={kEur} tick={{ fontSize: 12 }} width={64} />
        <Tooltip formatter={(v, n) => [eur(Number(v)), n]} />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Bar isAnimationActive={false} dataKey="prevu" name="Prévu HT" className="pj-stats-serie-marine" radius={[4, 4, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="engage" name="Engagé HT" className="pj-stats-serie-accent" radius={[4, 4, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="mandate" name="Payé HT" className="pj-stats-serie-success" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SubventionsChart({ s }: { s: Statistiques["subventions"] }) {
  const data = [
    { nom: "Sollicitées", montant: s.sollicitees },
    { nom: "Accordées", montant: s.accordees },
    { nom: "Encaissées", montant: s.encaissees },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="nom" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={kEur} tick={{ fontSize: 12 }} width={64} />
        <Tooltip formatter={(v) => [eur(Number(v)), "Montant"]} />
        {/* Couleur de chaque barre : .pj-stats-serie-multi (CSS, nth-child). */}
        <Bar isAnimationActive={false} dataKey="montant" name="Montant" className="pj-stats-serie-multi" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
