import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Inbox, FileText, AlertTriangle, CheckCircle2,
  Wrench, Plus, ArrowRight, MapPin,
} from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { listTickets } from "@/lib/tickets/queries";
import {
  PrioriteBadge, StatutBadge,
} from "@/components/tickets/TicketBadge";
import SurveysSection from "./SurveysSection";

// ═══════════════════════════════════════════════════════════════
// /admin/dashboard — Cross-module dashboard
//
// Server Component qui agrège :
//   • KPIs sondages (count, actifs, réponses)
//   • KPIs tickets (ouverts, urgents, résolus 7j)
//   • Top 3 tickets ouverts (priorité décroissante)
//   • Section sondages (client component existant)
//
// Module-aware : ne montre une section que si le module est actif
// pour la commune (ou si super-admin).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");

  const service = await createServiceClient();

  // Modules activés
  const isSuperAdmin = ctx.role === "super_admin";
  let activeModules: string[] = [];
  if (isSuperAdmin) {
    const { data } = await service.from("modules").select("id").eq("is_available", true);
    activeModules = (data ?? []).map((m) => m.id);
  } else {
    const { data } = await service
      .from("commune_modules")
      .select("module_id")
      .eq("commune_id", ctx.communeId);
    activeModules = (data ?? []).map((m) => m.module_id);
  }

  const hasSurveys = activeModules.includes("surveys");
  const hasTickets = activeModules.includes("tickets");

  // ─── Stats sondages ───
  let surveysActive = 0;
  let surveysTotal = 0;
  let responsesTotal = 0;
  if (hasSurveys) {
    const { data } = await service
      .from("surveys")
      .select("id, status, responses(count)")
      .eq("commune_id", ctx.communeId)
      .is("deleted_at", null);
    surveysTotal = data?.length ?? 0;
    surveysActive = data?.filter((s) => s.status === "published").length ?? 0;
    responsesTotal = (data ?? []).reduce((sum, s) => {
      const arr = s.responses as unknown as { count: number }[] | undefined;
      return sum + (arr?.[0]?.count ?? 0);
    }, 0);
  }

  // ─── Stats tickets ───
  let tickets: Awaited<ReturnType<typeof listTickets>> = [];
  let ticketsOpen = 0;
  let ticketsUrgent = 0;
  let ticketsResolved7d = 0;
  if (hasTickets) {
    tickets = await listTickets(ctx.communeId, { limit: 200 });
    const openStatuts = ["nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente"];
    ticketsOpen = tickets.filter((t) => openStatuts.includes(t.statut)).length;
    ticketsUrgent = tickets.filter((t) => t.priorite === "urgente" && openStatuts.includes(t.statut)).length;
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    ticketsResolved7d = tickets.filter((t) => t.resolu_at && new Date(t.resolu_at).getTime() >= sevenDaysAgo).length;
  }

  const topTickets = tickets
    .filter((t) => !["clos", "annule"].includes(t.statut))
    .sort((a, b) => {
      const order = { urgente: 4, haute: 3, normale: 2, basse: 1 } as const;
      return (order[b.priorite] ?? 0) - (order[a.priorite] ?? 0);
    })
    .slice(0, 3);

  return (
    <main className="civiq-main">
      {/* En-tête */}
      <div className="civiq-page-header">
        <div>
          <h1 className="civiq-page-title">Tableau de bord</h1>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 3 }}>
            Vue d&apos;ensemble de l&apos;activité de votre commune.
          </p>
        </div>
      </div>

      {/* KPIs cross-module */}
      <div className="civiq-stats-grid" style={{ marginBottom: 26 }}>
        {hasSurveys && (
          <Kpi icon={<FileText size={18} />} value={surveysTotal} label="Sondages créés" sub={`${surveysActive} actif${surveysActive > 1 ? "s" : ""}`} />
        )}
        {hasSurveys && (
          <Kpi icon={<CheckCircle2 size={18} />} value={responsesTotal} label="Réponses citoyennes" sub="cumul tous sondages" tone="success" />
        )}
        {hasTickets && (
          <Kpi icon={<Inbox size={18} />} value={ticketsOpen} label="Tickets ouverts" sub={ticketsUrgent ? `${ticketsUrgent} urgent${ticketsUrgent > 1 ? "s" : ""}` : "—"} tone={ticketsUrgent > 0 ? "danger" : "default"} />
        )}
        {hasTickets && (
          <Kpi icon={<CheckCircle2 size={18} />} value={ticketsResolved7d} label="Résolus (7j)" sub="interventions terminées" tone="success" />
        )}
      </div>

      {/* Section Tickets en haut (si actif) */}
      {hasTickets && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "oklch(0.95 0.04 30)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wrench size={16} />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", letterSpacing: "-0.01em" }}>
                Tickets prioritaires
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/admin/tickets" className="civiq-btn civiq-btn-outline civiq-btn-sm">
                Tous les tickets <ArrowRight size={13} />
              </Link>
              {(ctx.role === "admin" || ctx.role === "editor" || ctx.role === "super_admin") && (
                <Link href="/admin/tickets/nouveau" className="civiq-btn civiq-btn-default civiq-btn-sm">
                  <Plus size={13} /> Nouveau ticket
                </Link>
              )}
            </div>
          </div>

          {topTickets.length === 0 ? (
            <div className="civiq-card" style={{ textAlign: "center", padding: 32, borderStyle: "dashed" }}>
              <CheckCircle2 size={28} style={{ color: "var(--success)", margin: "0 auto 8px" }} />
              <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Tous les tickets sont à jour. Bravo 👏</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {topTickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/tickets/${t.id}`}
                  className="civiq-card civiq-card-hover"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", textDecoration: "none" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <PrioriteBadge priorite={t.priorite} />
                      <StatutBadge statut={t.statut} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ color: "var(--fg-xmuted)", fontFamily: "ui-monospace, monospace", marginRight: 6, fontSize: 12 }}>#{t.numero}</span>
                      {t.titre}
                    </div>
                    {t.adresse && (
                      <div style={{ fontSize: 12, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={11} /> {t.adresse.length > 60 ? t.adresse.slice(0, 60) + "…" : t.adresse}
                      </div>
                    )}
                  </div>
                  <ArrowRight size={16} style={{ color: "var(--fg-xmuted)", flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Section Sondages (si actif) */}
      {hasSurveys && <SurveysSection />}

      {/* Aucun module activé */}
      {!hasSurveys && !hasTickets && (
        <div className="civiq-card" style={{ textAlign: "center", padding: "48px 24px", borderStyle: "dashed" }}>
          <AlertTriangle size={36} style={{ color: "var(--warning)", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", marginBottom: 8 }}>Aucun module activé</h2>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", maxWidth: 400, margin: "0 auto 16px" }}>
            Demandez à un administrateur de la plateforme d&apos;activer les modules dont vous avez besoin (sondages, tickets…).
          </p>
        </div>
      )}
    </main>
  );
}

function Kpi({ icon, value, label, sub, tone }: {
  icon: React.ReactNode; value: number | string; label: string; sub?: string;
  tone?: "default" | "success" | "danger";
}) {
  const bg =
    tone === "success" ? "oklch(0.95 0.06 155)" :
    tone === "danger"  ? "oklch(0.95 0.07 25)"  :
    "oklch(0.95 0.04 258)";
  const fg =
    tone === "success" ? "var(--success)" :
    tone === "danger"  ? "var(--destructive)" :
    "var(--accent)";
  return (
    <div className="civiq-card civiq-stat-card">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: "var(--radius)", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--fg)", lineHeight: 1.05 }}>
            {value}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4, fontWeight: 500 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--fg-xmuted)", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}
