import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { parseMontant } from "@/lib/projects/money-validation";

// GET  /api/super-admin/seuils — seuils de commande publique (toutes versions)
// POST /api/super-admin/seuils — nouvelle valeur datée (jamais d'écrasement :
//                                 l'ancienne reçoit une date de fin).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  const service = await createServiceClient();
  const { data, error } = await service
    .from("seuils_commande_publique")
    .select("*")
    .order("categorie").order("type").order("date_effet", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seuils: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const categorie = body.categorie;
  const type = body.type;
  const montant = parseMontant(body.montant_ht);
  const dateEffet = typeof body.date_effet === "string" && DATE_RE.test(body.date_effet) ? body.date_effet : null;
  if (categorie !== "travaux" && categorie !== "fournitures_services") return NextResponse.json({ error: "Catégorie inconnue" }, { status: 400 });
  if (type !== "dispense" && type !== "seuil_europeen") return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
  if (!montant || Number.isNaN(montant)) return NextResponse.json({ error: "Montant HT requis" }, { status: 400 });
  if (!dateEffet) return NextResponse.json({ error: "Date d'effet requise" }, { status: 400 });

  const service = await createServiceClient();
  // La version en cours à cette date se termine la veille.
  const veille = new Date(Date.parse(`${dateEffet}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  await service
    .from("seuils_commande_publique")
    .update({ date_fin: veille, updated_by: ctx!.userId })
    .eq("categorie", categorie).eq("type", type)
    .lt("date_effet", dateEffet)
    .or(`date_fin.is.null,date_fin.gte.${dateEffet}`);

  const { data, error } = await service
    .from("seuils_commande_publique")
    .insert({
      categorie, type, montant_ht: montant, date_effet: dateEffet,
      date_fin: typeof body.date_fin === "string" && DATE_RE.test(body.date_fin) ? body.date_fin : null,
      reference: typeof body.reference === "string" ? body.reference.trim() || null : null,
      commentaire: typeof body.commentaire === "string" ? body.commentaire.trim() || null : null,
      updated_by: ctx!.userId,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Une valeur existe déjà à cette date d'effet." : error.message }, { status: 400 });

  await writeAudit({ action: "platform.seuil.created", targetType: "seuil", targetId: data.id, metadata: { categorie, type, montant, dateEffet } });
  return NextResponse.json({ seuil: data });
}
