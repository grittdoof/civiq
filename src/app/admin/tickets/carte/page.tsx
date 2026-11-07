import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { listTickets } from "@/lib/tickets/queries";
import { chargerSpectateur } from "@/lib/tickets/droits-server";
import { urlPhoto } from "@/lib/tickets/pieces";
import TicketsMap from "./TicketsMap";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/carte — Vue cartographique des tickets
//
// Server : récupère les tickets géolocalisés + URLs signées des
// premières photos. Le rendu Leaflet est dans TicketsMap (client).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function TicketsMapPage() {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) redirect("/admin/dashboard?module=tickets&state=inactive");
  }

  const tickets = await listTickets(ctx.communeId, {}, await chargerSpectateur());
  const geoTickets = tickets.filter((t) => t.latitude != null && t.longitude != null);

  // Vignettes des pop-ups : miniature via l'adresse stable de notre route
  const photoUrls: Record<string, string> = {};
  for (const t of geoTickets) {
    const first = t.signalement_photos?.[0];
    if (first) photoUrls[t.id] = urlPhoto(t.id, first.id, { miniature: true });
  }

  // Centre par défaut sur la commune si on n'a pas de ticket géolocalisé
  const center: [number, number] =
    geoTickets[0] && geoTickets[0].latitude != null && geoTickets[0].longitude != null
      ? [geoTickets[0].latitude, geoTickets[0].longitude]
      : [46.881, -1.978];

  return (
    <main className="civiq-main" style={{ paddingBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <Link href="/admin/tickets" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none" }}>
          <ArrowLeft size={14} /> Liste
        </Link>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 className="civiq-page-title" style={{ margin: 0 }}>Carte des tickets</h1>
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {geoTickets.length} géolocalisé{geoTickets.length > 1 ? "s" : ""} · {tickets.length} total
          </span>
        </div>
        <Link href="/admin/tickets" className="civiq-btn civiq-btn-outline civiq-btn-sm">
          <LayoutGrid size={13} /> Vue liste
        </Link>
      </div>

      <TicketsMap
        center={center}
        tickets={geoTickets.map((t) => ({
          id: t.id,
          numero: t.numero,
          titre: t.titre,
          priorite: t.priorite,
          statut: t.statut,
          categorie: t.categorie,
          latitude: t.latitude!,
          longitude: t.longitude!,
          adresse: t.adresse,
          photoUrl: photoUrls[t.id] ?? null,
        }))}
      />
    </main>
  );
}
