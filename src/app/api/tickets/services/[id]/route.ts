import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { gardeGestionServices, nomServiceValide } from "@/lib/tickets/services-server";

// ═══════════════════════════════════════════════════════════════
// PATCH  /api/tickets/services/:id — { nom?, membres?: string[] }
// DELETE /api/tickets/services/:id — suppression logique ; les
//   signalements rattachés gardent leur historique (service_id reste,
//   le service n'est plus proposé ni compté pour la visibilité).
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }> }

async function serviceDeLaCommune(g: Extract<Awaited<ReturnType<typeof gardeGestionServices>>, { ok: true }>, id: string) {
  const { data } = await g.service
    .from("services").select("id, nom").eq("id", id).eq("commune_id", g.communeId).is("deleted_at", null).maybeSingle();
  return data;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const { id } = await params;
  const svc = await serviceDeLaCommune(g, id);
  if (!svc) return NextResponse.json({ error: "Service introuvable" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { nom?: unknown; membres?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  if (body.nom !== undefined) {
    const nom = nomServiceValide(body.nom);
    if (!nom) return NextResponse.json({ error: "Nom de service : 2 à 80 caractères" }, { status: 400 });
    const { error } = await g.service.from("services").update({ nom }).eq("id", id);
    if (error) {
      const doublon = error.code === "23505";
      return NextResponse.json({ error: doublon ? "Un service porte déjà ce nom" : error.message }, { status: doublon ? 409 : 500 });
    }
  }

  if (body.membres !== undefined) {
    if (!Array.isArray(body.membres) || body.membres.some((m) => typeof m !== "string")) {
      return NextResponse.json({ error: "Membres invalides" }, { status: 400 });
    }
    const voulus = [...new Set(body.membres as string[])];
    if (voulus.length > 0) {
      const { data: ok } = await g.service
        .from("profiles").select("id").in("id", voulus).eq("commune_id", g.communeId).in("role", ["admin", "editor"]);
      if ((ok ?? []).length !== voulus.length) {
        return NextResponse.json({ error: "Une personne n'appartient pas à la commune" }, { status: 400 });
      }
    }
    const { data: actuels } = await g.service.from("service_membres").select("profile_id").eq("service_id", id);
    const avant = new Set((actuels ?? []).map((a) => a.profile_id as string));
    const ajoutes = voulus.filter((p) => !avant.has(p));
    const retires = [...avant].filter((p) => !voulus.includes(p));
    if (retires.length) await g.service.from("service_membres").delete().eq("service_id", id).in("profile_id", retires);
    if (ajoutes.length) {
      const { error } = await g.service.from("service_membres").insert(ajoutes.map((profile_id) => ({ service_id: id, profile_id })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (ajoutes.length || retires.length) {
      await writeAudit({ action: "tickets.service_membres", targetType: "service", targetId: id, communeId: g.communeId, metadata: { ajoutes: ajoutes.length, retires: retires.length } });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const { id } = await params;
  const svc = await serviceDeLaCommune(g, id);
  if (!svc) return NextResponse.json({ error: "Service introuvable" }, { status: 404 });
  const { error } = await g.service
    .from("services").update({ deleted_at: new Date().toISOString(), deleted_by: g.userId }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit({ action: "tickets.service_supprime", targetType: "service", targetId: id, communeId: g.communeId, metadata: { nom: svc.nom } });
  return NextResponse.json({ ok: true });
}
