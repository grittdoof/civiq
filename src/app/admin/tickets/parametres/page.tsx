import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listerEquipe, listerServices } from "@/lib/tickets/services-server";
import { chargerSpectateur } from "@/lib/tickets/droits-server";
import { FONCTIONS_MATRICE, PORTEES, fonctionDe } from "@/lib/tickets/droits";
import ServicesEditor from "@/components/tickets/ServicesEditor";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/parametres — Services de la commune et leurs membres
// (lot 1). Réservé à l'administrateur de la commune et au super-admin.
// La matrice des droits se règle par le super-admin (fiche commune).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function ParametresTicketsPage() {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin") {
    if (!(await isModuleActive("tickets"))) redirect("/admin/dashboard?module=tickets&state=inactive");
  }
  if (ctx.role !== "admin" && ctx.role !== "super_admin") redirect("/admin/tickets");

  const service = await createServiceClient();
  const [services, equipe, spectateur] = await Promise.all([
    listerServices(service, ctx.communeId),
    listerEquipe(service, ctx.communeId),
    chargerSpectateur(),
  ]);
  const { data: profil } = await service.from("profiles").select("job_title").eq("id", ctx.userId).maybeSingle();
  const maFonction = FONCTIONS_MATRICE.find((f) => f.fonction === fonctionDe(profil?.job_title))?.libelle;
  const maPortee = PORTEES.find((p) => p.valeur === spectateur?.ligne?.voit)?.libelle ?? "Rien";

  return (
    <main className="civiq-main" style={{ maxWidth: 900 }}>
      <Link href="/admin/tickets" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={14} /> Tickets
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Paramètres des tickets</h1>
      <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: "0 0 24px", lineHeight: 1.55 }}>
        Chaque ticket peut être rattaché à un service. Selon les droits de la commune, les membres d&apos;un service voient les tickets de ce service ;
        pour un adjoint, ses services correspondent à sa délégation.
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Services et membres</h2>
        <ServicesEditor initial={services} equipe={equipe} />
      </section>

      <section className="civiq-card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Droits par fonction</h2>
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: 0, lineHeight: 1.55 }}>
          Ce que chaque fonction voit et peut faire est réglé par l&apos;administrateur de la plateforme.
          {maFonction && <> Votre fonction : <strong style={{ color: "var(--fg)" }}>{maFonction}</strong> — vous voyez : <strong style={{ color: "var(--fg)" }}>{ctx.role === "super_admin" ? "tout (super-admin)" : maPortee}</strong>.</>}
        </p>
        {ctx.role === "super_admin" && (
          <p style={{ margin: "10px 0 0" }}>
            <Link href={`/super-admin/communes/${ctx.communeId}`} style={{ fontSize: 13.5, fontWeight: 600 }}>Régler la matrice de cette commune →</Link>
          </p>
        )}
      </section>
    </main>
  );
}
