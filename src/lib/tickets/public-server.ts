import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase-server";
import { listerCategories } from "./categories-server";
import { agregatsPublics, themesPublies, type AgregatsPublics, type PeriodePublique, type TicketPublic } from "./public";

// ═══════════════════════════════════════════════════════════════
// Données de la page publique (lot 4 bis), mises en cache une heure.
// Seules les colonnes nécessaires aux chiffres sont lues : jamais de
// titre, description, adresse ni personne. Tickets « standard » seuls.
// ═══════════════════════════════════════════════════════════════

export interface PagePublique {
  commune: { id: string; nom: string; logo: string | null; telephone: string | null; email: string | null; site: string | null };
  agregats: AgregatsPublics;
  misAJour: string;
}

async function calculer(slug: string, periode: PeriodePublique): Promise<PagePublique | null> {
  const service = await createServiceClient();
  const { data: c } = await service
    .from("communes").select("id, name, logo_url, phone, contact_email, website_url").eq("slug", slug).maybeSingle();
  if (!c) return null;
  const [{ data: reglage }, { data: module }] = await Promise.all([
    service.from("commune_settings").select("tickets_public_actif, tickets_public_categories").eq("commune_id", c.id).maybeSingle(),
    service.from("commune_modules").select("module_id").eq("commune_id", c.id).eq("module_id", "tickets").maybeSingle(),
  ]);
  if (!module || !reglage?.tickets_public_actif) return null;

  const categories = await listerCategories(service, c.id as string);
  const racineDe = new Map(categories.map((x) => [x.id, x.parent_id ?? x.id]));
  const themes = themesPublies(categories.filter((x) => !x.parent_id), (reglage.tickets_public_categories as string[] | null) ?? null);
  const { data: lignes } = await service
    .from("tickets")
    .select("categorie_id, statut, created_at, pris_en_charge_at, resolu_at, clos_at")
    .eq("commune_id", c.id)
    .eq("confidentialite", "standard");
  const tickets: TicketPublic[] = (lignes ?? [])
    .filter((t) => t.categorie_id)
    .map((t) => ({
      racine_id: racineDe.get(t.categorie_id as string) ?? "",
      statut: t.statut as string,
      created_at: t.created_at as string,
      pris_en_charge_at: t.pris_en_charge_at as string | null,
      termine_le: (t.clos_at as string | null) ?? (t.resolu_at as string | null),
    }));
  return {
    commune: {
      id: c.id as string, nom: c.name as string, logo: c.logo_url as string | null,
      telephone: c.phone as string | null, email: c.contact_email as string | null, site: c.website_url as string | null,
    },
    agregats: agregatsPublics(tickets, themes, periode),
    misAJour: new Date().toISOString(),
  };
}

export function chargerPagePublique(slug: string, periode: PeriodePublique): Promise<PagePublique | null> {
  return unstable_cache(() => calculer(slug, periode), ["tickets-public", slug, periode], {
    revalidate: 3600, tags: [`tickets-public-${slug}`],
  })();
}
