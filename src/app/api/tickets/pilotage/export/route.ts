import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { chargerSpectateur } from "@/lib/tickets/droits-server";
import { valeurAction } from "@/lib/tickets/droits";
import { chargerPilotage, filtrer } from "@/lib/tickets/pilotage-server";
import { PERIODES, bornesPeriode, formatJours, ouvert, priseEnChargeLe, tableau, tendance, versCsv, type Periode } from "@/lib/tickets/pilotage";
import { URGENCE_LABELS, cheminCategorie, estUrgence } from "@/lib/tickets/categories";
import { STATUT_LABELS, type TicketStatut } from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// GET /api/tickets/pilotage/export?type=services|tickets&periode=…
// Export CSV du pilotage (lot 4), pour le conseil municipal ou les
// commissions. Droit « exporter » de la matrice. Mêmes règles que
// l'écran : confidentiels exclus, restreints non ouvrables jamais listés
// (ils restent comptés dans le tableau par service).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const garde = await requireModule("tickets");
  if (!garde.ok) return garde.response;
  const spectateur = await chargerSpectateur();
  if (!spectateur || valeurAction("exporter", spectateur) !== "oui" || !garde.communeId) {
    return NextResponse.json({ error: "Export non autorisé" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const periode: Periode = PERIODES.some((p) => p.valeur === sp.get("periode")) ? (sp.get("periode") as Periode) : "30j";
  const urgence = sp.get("urgence");
  const { tickets: tous, categories, services } = await chargerPilotage(garde.communeId, spectateur);
  const tickets = filtrer(tous, {
    serviceId: sp.get("service") || undefined,
    categorieRacineId: sp.get("categorie") || undefined,
    urgence: estUrgence(urgence) ? urgence : undefined,
  });
  const nomService = (id: string | null) => (id ? services.find((s) => s.id === id)?.nom ?? "Service supprimé" : "Sans service");
  const jour = new Date().toISOString().slice(0, 10);

  let csv: string;
  let nom: string;
  if (sp.get("type") === "tickets") {
    const { debut } = bornesPeriode(periode);
    const lignes = tickets
      .filter((t) => !t.masque && (ouvert(t) || new Date(t.clos_at ?? t.resolu_at ?? t.created_at) >= debut))
      .sort((a, b) => a.numero - b.numero)
      .map((t) => [
        t.numero, t.titre, cheminCategorie(t.categorie_id, categories).libelle, nomService(t.service_id),
        URGENCE_LABELS[t.urgence], STATUT_LABELS[t.statut as TicketStatut] ?? t.statut,
        t.created_at.slice(0, 10), priseEnChargeLe(t)?.slice(0, 10) ?? null, (t.clos_at ?? t.resolu_at)?.slice(0, 10) ?? null,
        t.delai_cible_le?.slice(0, 10) ?? null, t.adresse,
      ]);
    csv = versCsv(["N°", "Titre", "Catégorie", "Service", "Urgence", "Statut", "Créé le", "Pris en charge le", "Clôturé le", "Délai cible", "Adresse"], lignes);
    nom = `tickets-${periode}-${jour}.csv`;
  } else {
    const lignes = tableau(tickets, periode, (t) => t.service_id, nomService).map((l) => [
      l.libelle, l.ouverts, l.enCours, l.enRetard, formatJours(l.delaiMoyen), l.clotures, l.crees, tendance(l.crees, l.creesPrecedente).texte,
    ]);
    csv = versCsv(["Service", "Ouverts", "En cours", "En retard", "Délai moyen", "Clôturés", "Créés", "Tendance"], lignes);
    nom = `pilotage-services-${periode}-${jour}.csv`;
  }
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "no-store",
    },
  });
}
