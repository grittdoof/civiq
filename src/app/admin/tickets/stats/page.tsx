import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Inbox, CheckCircle2, Clock, TrendingUp, AlertTriangle, RefreshCcw } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { listTickets } from "@/lib/tickets/queries";
import { isModuleActive } from "@/lib/module-guard";
import StatsCharts from "./StatsCharts";
import {
  CATEGORIE_LABELS, PRIORITE_LABELS, type TicketCategorie, type TicketPriorite,
} from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/stats — Tableau de bord du module
// KPIs + graphiques recharts (server-side data, client-side render)
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function TicketsStatsPage() {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) redirect("/admin/dashboard?module=tickets&state=inactive");
  }

  const tickets = await listTickets(ctx.communeId, { limit: 1000 });

  // Vue reporting enrichie (migration 013)
  const service = await (await import("@/lib/supabase-server")).createServiceClient();
  const { data: reportingRows } = await service
    .from("tickets_reporting_v")
    .select("en_retard, a_ete_reouvert, canal, statut")
    .eq("commune_id", ctx.communeId);

  // Nouveaux KPIs
  const enRetard = (reportingRows ?? []).filter((r) => r.en_retard).length;
  const reouvertures = (reportingRows ?? []).filter((r) => r.a_ete_reouvert).length;
  const totalResolus = (reportingRows ?? []).filter((r) => r.statut === "resolu" || r.statut === "clos").length;
  const tauxReouverture = totalResolus > 0 ? Math.round((reouvertures / totalResolus) * 100) : 0;

  // Répartition par canal
  const canalLabels: Record<string, string> = {
    agent_interne: "Agent municipal",
    elu_terrain: "Élu terrain",
    email: "Email",
    telephone: "Téléphone",
  };
  const byCanalMap = new Map<string, number>();
  (reportingRows ?? []).forEach((r) => {
    byCanalMap.set(r.canal, (byCanalMap.get(r.canal) ?? 0) + 1);
  });
  const canalData = Array.from(byCanalMap.entries())
    .map(([canal, value]) => ({ name: canalLabels[canal] ?? canal, value }))
    .sort((a, b) => b.value - a.value);

  // ─── KPIs ───
  const ouvertsStatuts = ["nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente"] as const;
  const ouverts = tickets.filter((t) => (ouvertsStatuts as readonly string[]).includes(t.statut)).length;

  const now = Date.now();
  const monthAgo = now - 30 * 86_400_000;
  const closThisMonth = tickets.filter(
    (t) => (t.statut === "resolu" || t.statut === "clos")
      && t.resolu_at
      && new Date(t.resolu_at).getTime() >= monthAgo
  ).length;

  // Délai moyen de résolution (en heures) sur les tickets résolus
  const resolved = tickets.filter((t) => t.resolu_at);
  const avgHours = resolved.length
    ? Math.round(
        resolved.reduce((sum, t) => sum + (new Date(t.resolu_at!).getTime() - new Date(t.created_at).getTime()), 0)
        / resolved.length
        / 3_600_000
      )
    : 0;
  const avgDisplay = avgHours < 24 ? `${avgHours} h` : `${Math.round(avgHours / 24)} j`;

  // Taux résolution sous 7 jours
  const within7d = resolved.filter(
    (t) => (new Date(t.resolu_at!).getTime() - new Date(t.created_at).getTime()) <= 7 * 86_400_000
  ).length;
  const within7dPct = resolved.length ? Math.round((within7d / resolved.length) * 100) : 0;

  // ─── Tickets créés par semaine (12 dernières) ───
  const weekly: { week: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now - i * 7 * 86_400_000);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 7 * 86_400_000);
    const count = tickets.filter((t) => {
      const c = new Date(t.created_at).getTime();
      return c >= start.getTime() && c < end.getTime();
    }).length;
    weekly.push({
      week: start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      count,
    });
  }

  // ─── Répartition par catégorie ───
  const byCat = new Map<TicketCategorie, number>();
  tickets.forEach((t) => byCat.set(t.categorie, (byCat.get(t.categorie) ?? 0) + 1));
  const categorieData = Array.from(byCat.entries())
    .map(([cat, value]) => ({ name: CATEGORIE_LABELS[cat], value }))
    .sort((a, b) => b.value - a.value);

  // ─── Répartition par priorité ───
  const byPrio = new Map<TicketPriorite, number>();
  tickets.forEach((t) => byPrio.set(t.priorite, (byPrio.get(t.priorite) ?? 0) + 1));
  const prioriteOrder: TicketPriorite[] = ["basse", "normale", "haute", "urgente"];
  const prioriteData = prioriteOrder.map((p) => ({ name: PRIORITE_LABELS[p], value: byPrio.get(p) ?? 0 }));

  // ─── Top 5 agents (tickets clôturés) ───
  const agentMap = new Map<string, { id: string; name: string; closedCount: number }>();
  tickets.forEach((t) => {
    if (t.statut !== "clos" && t.statut !== "resolu") return;
    const id = t.assignee_profile?.id;
    const name = t.assignee_profile?.full_name;
    if (!id || !name) return;
    const cur = agentMap.get(id) ?? { id, name, closedCount: 0 };
    cur.closedCount += 1;
    agentMap.set(id, cur);
  });
  const topAgents = Array.from(agentMap.values()).sort((a, b) => b.closedCount - a.closedCount).slice(0, 5);

  // ─── Heatmap geo (positions de tickets) ───
  const geoPoints = tickets
    .filter((t) => t.latitude != null && t.longitude != null)
    .map((t) => ({ lat: t.latitude as number, lng: t.longitude as number, weight: t.priorite === "urgente" ? 3 : t.priorite === "haute" ? 2 : 1 }));

  return (
    <main className="civiq-main">
      <Link
        href="/admin/tickets"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 14 }}
      >
        <ArrowLeft size={14} /> Tickets
      </Link>

      <header style={{ marginBottom: 22 }}>
        <h1 className="civiq-page-title">Statistiques</h1>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 4 }}>
          Performance et activité des interventions techniques.
        </p>
      </header>

      {/* KPIs */}
      <div className="civiq-stats-grid" style={{ marginBottom: 22 }}>
        <KpiCard icon={<Inbox size={18} />} value={ouverts} label="Tickets ouverts" sub="actifs en ce moment" />
        <KpiCard icon={<CheckCircle2 size={18} />} value={closThisMonth} label="Résolus ce mois" sub="30 derniers jours" tone="success" />
        <KpiCard icon={<Clock size={18} />} value={avgDisplay} label="Délai moyen" sub="création → résolution" />
        <KpiCard icon={<TrendingUp size={18} />} value={`${within7dPct}%`} label="Résolus sous 7j" sub={`${within7d} tickets`} tone="accent" />
      </div>

      {/* KPIs avancés (vue tickets_reporting_v) */}
      <div className="civiq-stats-grid" style={{ marginBottom: 22 }}>
        <KpiCard
          icon={<AlertTriangle size={18} />}
          value={enRetard}
          label="Tickets en retard"
          sub={enRetard ? "échéance dépassée" : "Aucun retard 👌"}
          tone={enRetard > 0 ? "danger" : "default"}
        />
        <KpiCard
          icon={<RefreshCcw size={18} />}
          value={`${tauxReouverture}%`}
          label="Taux de réouverture"
          sub={`${reouvertures} tickets concernés`}
        />
        <KpiCard
          icon={<Inbox size={18} />}
          value={canalData[0]?.name ?? "—"}
          label="Canal #1"
          sub={canalData[0] ? `${canalData[0].value} tickets` : "—"}
          tone="accent"
        />
      </div>

      <StatsCharts
        weekly={weekly}
        categorieData={categorieData}
        prioriteData={prioriteData}
        topAgents={topAgents}
        geoPoints={geoPoints}
      />
    </main>
  );
}

function KpiCard({ icon, value, label, sub, tone }: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  sub?: string;
  tone?: "default" | "accent" | "success" | "danger";
}) {
  const bg =
    tone === "success" ? "oklch(0.95 0.06 155)" :
    tone === "danger"  ? "oklch(0.95 0.07 25)"  :
    tone === "accent"  ? "oklch(0.95 0.05 30)"  :
    "oklch(0.95 0.04 258)";
  const fg =
    tone === "success" ? "var(--success)" :
    tone === "danger"  ? "var(--destructive)" :
    "var(--accent)";
  return (
    <div className="civiq-card civiq-stat-card">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--fg)", lineHeight: 1.1 }}>
            {value}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4, fontWeight: 500 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--fg-xmuted)", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}
