import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listerEquipe, listerServices, rattachementsPossibles } from "@/lib/tickets/services-server";
import RattacherServices from "@/components/tickets/RattacherServices";
import { chargerSpectateur } from "@/lib/tickets/droits-server";
import { FONCTIONS_MATRICE, PORTEES, fonctionDe } from "@/lib/tickets/droits";
import ServicesEditor from "@/components/tickets/ServicesEditor";
import CategoriesEditor from "@/components/tickets/CategoriesEditor";
import PagePubliqueReglage from "@/components/tickets/PagePubliqueReglage";
import PeriscolaireReglages, { type Site } from "@/components/tickets/PeriscolaireReglages";
import { NON_PUBLIES_PAR_DEFAUT } from "@/lib/tickets/public";
import { listerCategories } from "@/lib/tickets/categories-server";

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
  const [services, equipe, spectateur, categories, { count: nbAutre }, { data: reglage }, { data: commune }, { data: sites }, rattachables, { count: nbSansService }] = await Promise.all([
    listerServices(service, ctx.communeId),
    listerEquipe(service, ctx.communeId),
    chargerSpectateur(),
    listerCategories(service, ctx.communeId),
    service.from("tickets").select("id", { count: "exact", head: true }).eq("commune_id", ctx.communeId).eq("categorie", "autre"),
    service.from("commune_settings").select("tickets_public_actif, tickets_public_categories, tickets_effacement_enfant_mois").eq("commune_id", ctx.communeId).maybeSingle(),
    service.from("communes").select("slug").eq("id", ctx.communeId).maybeSingle(),
    service.from("sites").select("id, nom, type, adresse").eq("commune_id", ctx.communeId).is("deleted_at", null).order("nom"),
    rattachementsPossibles(service, ctx.communeId),
    service.from("tickets").select("id", { count: "exact", head: true }).eq("commune_id", ctx.communeId).is("service_id", null),
  ]);
  const nbRattachables = [...rattachables.values()].reduce((n, ids) => n + ids.length, 0);
  const racines = categories.filter((c) => !c.parent_id && c.actif);
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

      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", margin: "0 0 4px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Catégories</h2>
          {(nbAutre ?? 0) > 0 && (
            <Link href="/admin/tickets/requalifier" style={{ fontSize: 13.5, fontWeight: 600 }}>Requalifier les tickets « Autre » ({nbAutre}) →</Link>
          )}
        </div>
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "0 0 12px", lineHeight: 1.55 }}>
          À la création d&apos;un ticket, la catégorie propose son service, son urgence et sa visibilité, et calcule le délai cible.
          Une sous-catégorie sans réglage reprend ceux de sa catégorie.
        </p>
        {(nbSansService ?? 0) > 0 && <RattacherServices possibles={nbRattachables} sansService={nbSansService ?? 0} />}
        <CategoriesEditor initial={categories} services={services.map((s) => ({ id: s.id, nom: s.nom }))} />
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Périscolaire</h2>
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "0 0 12px", lineHeight: 1.55 }}>
          Les lieux proposés à la création d&apos;un ticket périscolaire. Le prénom de l&apos;enfant, facultatif, est effacé automatiquement.
        </p>
        <PeriscolaireReglages sitesInitiaux={(sites ?? []) as Site[]} effacementInitial={(reglage?.tickets_effacement_enfant_mois as number | null) ?? null} />
      </section>

      {commune?.slug && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Page publique pour les habitants</h2>
          <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "0 0 12px", lineHeight: 1.55 }}>
            Une page sans connexion qui présente l&apos;activité des services : interventions terminées, délais, thèmes. Désactivée par défaut.
          </p>
          <PagePubliqueReglage
            slug={commune.slug as string}
            actifInitial={!!reglage?.tickets_public_actif}
            choisisInitial={(reglage?.tickets_public_categories as string[] | null) ?? null}
            themes={racines.map((r) => ({ id: r.id, libelle: r.libelle, parDefaut: !NON_PUBLIES_PAR_DEFAUT.includes(r.code) }))}
          />
        </section>
      )}

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
