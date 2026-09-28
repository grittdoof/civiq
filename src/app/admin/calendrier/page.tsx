import { redirect } from "next/navigation";
import "../projects/projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { listCalendarEvents } from "@/lib/projects/calendar-queries";
import CalendarView from "@/components/projects/CalendarView";
import AgendaAbonnement from "@/components/projects/AgendaAbonnement";

export const dynamic = "force-dynamic";

export default async function CalendrierPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const [{ events, commissions, referents }, { google }] = await Promise.all([listCalendarEvents(ctx.communeId), searchParams]);

  return (
    <main className="civiq-main pj-detail-page">
      <header className="pj-page-header">
        <div>
          <h1 className="civiq-page-title">Calendrier</h1>
          <p className="pj-page-subtitle">
            Toutes les dates des projets (investissements, événements, suivis) et les séances de commission.
          </p>
        </div>
      </header>

      <AgendaAbonnement retourGoogle={google ?? null} />
      <CalendarView events={events} commissions={commissions} referents={referents} />
    </main>
  );
}
