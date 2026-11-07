import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listTickets } from "@/lib/tickets/queries";
import { chargerSpectateur } from "@/lib/tickets/droits-server";
import { listerCategories } from "@/lib/tickets/categories-server";
import { suggererCategorie } from "@/lib/tickets/categories";
import RequalificationListe from "@/components/tickets/RequalificationListe";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/requalifier — tickets restés en « Autre » (lot 2).
// Réservé à l'administrateur de la commune et au super-admin ; chaque
// changement vérifie en plus le droit « modifier » sur le ticket.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function RequalifierPage() {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin" && !(await isModuleActive("tickets"))) redirect("/admin/dashboard?module=tickets&state=inactive");
  if (ctx.role !== "admin" && ctx.role !== "super_admin") redirect("/admin/tickets");

  const service = await createServiceClient();
  const [categories, tickets] = await Promise.all([
    listerCategories(service, ctx.communeId),
    listTickets(ctx.communeId, {}, await chargerSpectateur()),
  ]);
  const autre = categories.find((c) => c.code === "autre" && !c.parent_id);
  const lignes = tickets
    .filter((t) => !t.categorie_id || t.categorie_id === autre?.id)
    .sort((a, b) => b.numero - a.numero)
    .map((t) => ({
      id: t.id,
      numero: t.numero,
      titre: t.titre,
      extrait: t.description ? t.description.slice(0, 140) : null,
      suggestion: suggererCategorie(t.titre, t.description, categories)?.id ?? null,
    }));

  return (
    <main className="civiq-main" style={{ maxWidth: 960 }}>
      <Link href="/admin/tickets/parametres" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={14} /> Paramètres des tickets
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Requalifier les tickets « Autre »</h1>
      <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: "0 0 20px", lineHeight: 1.55 }}>
        {lignes.length} ticket{lignes.length > 1 ? "s" : ""} sans catégorie précise. Une catégorie est suggérée d&apos;après le titre et la description :
        vérifiez-la, corrigez-la si besoin, puis appliquez. Chaque changement est inscrit dans le journal du ticket.
      </p>
      <RequalificationListe lignes={lignes} categories={categories} />
    </main>
  );
}
