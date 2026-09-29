import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { peutChangerConfidentialite } from "@/lib/projects/confidentialite";
import { CORBEILLE_JOURS, peutSupprimerProjet, sauvegarderProjet } from "@/lib/projects/corbeille";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { getProject } from "@/lib/projects/queries";
import type { ProjectCompetence, ProjectType } from "@/lib/projects/types";
import { FOURCHETTES, type Fourchette } from "@/lib/projects/wizard";
import { parseMontant } from "@/lib/projects/money-validation";
import { softDeleteFields } from "@/lib/projects/soft-delete";
import { synchroniserAgendasApres } from "@/lib/calendar/after-change";

// ═══════════════════════════════════════════════════════════════
// GET    /api/projects/:id   — fiche projet complète
// PATCH  /api/projects/:id   — mise à jour des champs scalaires
//                              (pas la phase — utiliser /advance)
// DELETE /api/projects/:id   — suppression (admin only)
// ═══════════════════════════════════════════════════════════════

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) {
    return NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 });
  }
  const { id } = await params;
  const detail = await getProject(guard.communeId, id);
  if (!detail.project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

interface PatchBody {
  confidentiel?: boolean;
  confidentiel_motif?: string | null;
  titre?: string;
  description?: string | null;
  objectifs?: string | null;
  competence?: ProjectCompetence;
  budget_estime?: number;
  sans_subvention?: boolean;
  pilote_elu?: string | null;
  pilote_agent?: string | null;
  taux_inflation?: number | null;
  taux_actualisation?: number | null;
  cout_reel?: number | null;
  explication_ecart?: string | null;
  concerne_tiers?: boolean;
  tiers_nom?: string | null;
  tiers_type?: string | null;
  tiers_contact?: string | null;
  accompagne_sans_financer?: boolean;
  in_ppi?: boolean;
  // Migration 028 — le type se change via POST /api/projects/:id/type
  type?: ProjectType;
  // Lot B (migration 040)
  commission_pilote_id?: string | null;
  fourchette_estimation?: Fourchette | null;
  echeance_souhaitee?: string | null;
  evenement_debut?: string | null;
  evenement_fin?: string | null;
  lieu?: string | null;
  jauge?: number | null;
  blocs_supplementaires?: string[];
  avancement_manuel_pct?: number | null;
  avancement_manuel_motif?: string | null;
  // Lot C (migration 041)
  emprunt_prevu?: number | string | null;
  autofinancement_invest?: number | string | null;
  autofinancement_fonct?: number | string | null;
  autofinancement_assume?: boolean;
  date_consultation?: string | null;
  categorie_achat?: "travaux" | "fournitures_services";
  phase_not_applicable?: Record<string, string>;
  phase_progress?: Record<
    string,
    Record<string, { done: boolean; note: string | null; applicable?: boolean }>
  >;
}

const PATCH_ALLOWED = new Set<keyof PatchBody>([
  "titre",
  "description",
  "objectifs",
  "competence",
  "budget_estime",
  "sans_subvention",
  "pilote_elu",
  "pilote_agent",
  "taux_inflation",
  "taux_actualisation",
  "cout_reel",
  "explication_ecart",
  "concerne_tiers",
  "tiers_nom",
  "tiers_type",
  "tiers_contact",
  "accompagne_sans_financer",
  "in_ppi",
  "phase_not_applicable",
  "phase_progress",
  "echeance_souhaitee",
  "evenement_debut",
  "evenement_fin",
  "lieu",
]);

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) {
    return NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 });
  }
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const { id } = await params;
  let body: PatchBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  // Projet confidentiel invisible pour cet utilisateur : 404.
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(body) as (keyof PatchBody)[]) {
    if (!PATCH_ALLOWED.has(key)) continue;
    const v = body[key];
    if (typeof v === "string") updates[key] = v.trim() || null;
    else updates[key] = v;
  }
  if (typeof body.titre === "string") {
    const t = body.titre.trim();
    if (!t) return NextResponse.json({ error: "Le titre ne peut pas être vide" }, { status: 400 });
    updates.titre = t;
  }

  if (body.type !== undefined) {
    return NextResponse.json(
      { error: "Le changement de type passe par POST /api/projects/:id/type (règles de conservation des données)." },
      { status: 400 },
    );
  }

  // ─── Champs du lot B ───
  for (const key of ["echeance_souhaitee", "evenement_debut", "evenement_fin"] as const) {
    const v = updates[key];
    if (typeof v === "string" && Number.isNaN(Date.parse(v))) {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }
  }
  const service0 = await createServiceClient();
  if ("commission_pilote_id" in body) {
    const cid = body.commission_pilote_id || null;
    if (cid) {
      const { data: com } = await service0
        .from("commissions").select("id").eq("id", cid).eq("commune_id", guard.communeId).is("deleted_at", null).maybeSingle();
      if (!com) return NextResponse.json({ error: "Commission introuvable" }, { status: 404 });
      // La commission pilote suit aussi le projet (lien N-N existant).
      await service0.from("commission_projects").upsert(
        { commission_id: cid, project_id: id },
        { onConflict: "commission_id,project_id", ignoreDuplicates: true },
      );
    }
    updates.commission_pilote_id = cid;
  }
  for (const key of ["pilote_elu", "pilote_agent"] as const) {
    const pid = updates[key];
    if (typeof pid === "string") {
      const { data: prof } = await service0
        .from("profiles").select("id").eq("id", pid).eq("commune_id", guard.communeId).maybeSingle();
      if (!prof) return NextResponse.json({ error: "Personne introuvable dans la commune" }, { status: 404 });
    }
  }
  if ("fourchette_estimation" in body) {
    const f = body.fourchette_estimation ?? null;
    if (f !== null && !FOURCHETTES.some((x) => x.code === f)) {
      return NextResponse.json({ error: "Fourchette inconnue" }, { status: 400 });
    }
    updates.fourchette_estimation = f;
  }
  if ("jauge" in body) {
    const n = body.jauge === null || body.jauge === undefined || body.jauge === ("" as unknown) ? null : Number(body.jauge);
    if (n !== null && (!Number.isInteger(n) || n < 0)) return NextResponse.json({ error: "Jauge invalide" }, { status: 400 });
    updates.jauge = n;
  }
  if ("blocs_supplementaires" in body) {
    const b = Array.isArray(body.blocs_supplementaires) ? body.blocs_supplementaires.filter((x) => x === "devis") : [];
    updates.blocs_supplementaires = [...new Set(b)];
  }
  // ─── Lot C : plan de financement ───
  for (const key of ["emprunt_prevu", "autofinancement_invest", "autofinancement_fonct"] as const) {
    if (!(key in body)) continue;
    const m = parseMontant(body[key]);
    if (m === undefined || Number.isNaN(m)) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    updates[key] = m;
  }
  if (typeof body.autofinancement_assume === "boolean") {
    // Qui a coché, et quand : c'est ce qui lève le verrou du démarrage des travaux.
    Object.assign(updates, {
      autofinancement_assume: body.autofinancement_assume,
      autofinancement_assume_par: guard.userId,
      autofinancement_assume_le: new Date().toISOString(),
    });
  }
  if ("date_consultation" in body) {
    const d = body.date_consultation || null;
    if (d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    updates.date_consultation = d;
  }
  if ("categorie_achat" in body) {
    if (body.categorie_achat !== "travaux" && body.categorie_achat !== "fournitures_services") {
      return NextResponse.json({ error: "Catégorie d'achat inconnue" }, { status: 400 });
    }
    updates.categorie_achat = body.categorie_achat;
  }

  // Avancement ajusté à la main : motif obligatoire, auteur et date tracés.
  // Confidentialité (§2.10) : réservée au bureau municipal.
  if ("confidentiel" in body) {
    if (!peutChangerConfidentialite({ id: guard.userId, role: guard.role })) {
      return NextResponse.json({ error: "Seul un administrateur de la commune peut changer la confidentialité d'un projet." }, { status: 403 });
    }
    const on = body.confidentiel === true;
    const motif = typeof body.confidentiel_motif === "string" ? body.confidentiel_motif.trim().slice(0, 300) : "";
    if (on && !motif) return NextResponse.json({ error: "Indiquez en une phrase pourquoi ce projet est confidentiel." }, { status: 400 });
    Object.assign(updates, {
      confidentiel: on,
      confidentiel_motif: on ? motif : null,
      confidentiel_par: guard.userId,
      confidentiel_le: new Date().toISOString(),
    });
  }
  if ("avancement_manuel_pct" in body) {
    const pct = body.avancement_manuel_pct;
    if (pct === null) {
      Object.assign(updates, {
        avancement_manuel_pct: null, avancement_manuel_motif: null,
        avancement_manuel_par: guard.userId, avancement_manuel_le: new Date().toISOString(),
      });
    } else {
      const n = Number(pct);
      const motif = typeof body.avancement_manuel_motif === "string" ? body.avancement_manuel_motif.trim() : "";
      if (!Number.isFinite(n) || n < 0 || n > 100) return NextResponse.json({ error: "Un pourcentage entre 0 et 100." }, { status: 400 });
      if (!motif) return NextResponse.json({ error: "Expliquez en une phrase pourquoi vous ajustez l'avancement." }, { status: 400 });
      Object.assign(updates, {
        avancement_manuel_pct: Math.round(n), avancement_manuel_motif: motif.slice(0, 500),
        avancement_manuel_par: guard.userId, avancement_manuel_le: new Date().toISOString(),
      });
    }
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from("projects")
    .update(updates)
    .eq("id", id)
    .eq("commune_id", guard.communeId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  await writeAudit({
    action: "project.updated",
    targetType: "project",
    targetId: id,
    communeId: guard.communeId,
    metadata: { fields: Object.keys(updates) },
  });

  synchroniserAgendasApres(guard.communeId);
  return NextResponse.json({ ok: true });
}

// DELETE /api/projects/:id — mise à la corbeille (brief utilisateur du
// 2026-09-29) : bureau municipal, élu référent ou agent du projet. Une
// sauvegarde JSON est écrite avant ; le projet reste 30 jours dans la
// corbeille du super-administrateur, qui peut le restaurer.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => ({}))) as { motif?: unknown };
  const motif = typeof body.motif === "string" ? body.motif.trim().slice(0, 300) : "";
  if (!motif) return NextResponse.json({ error: "Indiquez en une phrase pourquoi ce projet est supprimé." }, { status: 400 });

  const service = await createServiceClient();
  const { data: projet } = await service
    .from("projects").select("pilote_elu, pilote_agent").eq("id", id).eq("commune_id", access.communeId).is("deleted_at", null).maybeSingle();
  if (!projet) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  if (!peutSupprimerProjet({ id: access.userId, role: access.role }, projet)) {
    return NextResponse.json({ error: "Seuls un administrateur de la commune, l'élu référent ou l'agent du projet peuvent le supprimer." }, { status: 403 });
  }

  // Sauvegarde d'abord : sans elle, pas de suppression.
  let sauvegarde: string;
  try {
    sauvegarde = (await sauvegarderProjet(service, id, "mise_a_la_corbeille")).path;
  } catch (e) {
    console.error("[projets] sauvegarde avant suppression", e);
    return NextResponse.json({ error: "La sauvegarde de sécurité a échoué : le projet n'a pas été supprimé. Réessayez." }, { status: 500 });
  }

  const { error } = await service
    .from("projects")
    .update({ ...softDeleteFields(access.userId), suppression_motif: motif })
    .eq("id", id)
    .eq("commune_id", access.communeId)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    action: "project.deleted",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { motif, sauvegarde },
  });

  synchroniserAgendasApres(access.communeId);
  return NextResponse.json({ ok: true, restaurable_jours: CORBEILLE_JOURS });
}
