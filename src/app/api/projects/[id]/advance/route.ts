import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { PROJECT_PHASES, type ProjectPhase, type AdvanceResult } from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// POST /api/projects/:id/advance
//
// Body : { to_phase, commentaire?, force? }
//
// Délègue toute la logique à la RPC SQL advance_project_phase()
// (source d'autorité serveur). Le state-machine TS est un miroir
// pour l'UX, pas pour la sécurité.
//
// Renvoie AdvanceResult :
//   • { ok: true, from_phase, to_phase, warnings: string[] }
//   • { ok: false, reason, require_force?, require_comment? }
// ═══════════════════════════════════════════════════════════════

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AdvanceBody {
  to_phase?: ProjectPhase;
  commentaire?: string;
  force?: boolean;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) {
    return NextResponse.json({ error: "Aucune commune attribuée" }, { status: 403 });
  }

  const { id } = await params;
  let body: AdvanceBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!body.to_phase || !PROJECT_PHASES.includes(body.to_phase)) {
    return NextResponse.json({ error: "to_phase invalide" }, { status: 400 });
  }

  // On appelle la RPC avec le client utilisateur (auth.uid() doit être
  // celui de l'appelant pour que la RPC vérifie ses droits).
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("advance_project_phase", {
    p_project_id: id,
    p_to_phase: body.to_phase,
    p_commentaire: body.commentaire ?? null,
    p_force: !!body.force,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? { ok: false }) as AdvanceResult;

  if (result.ok) {
    await writeAudit({
      action: "project.phase_changed",
      targetType: "project",
      targetId: id,
      communeId: guard.communeId,
      metadata: {
        from: result.from_phase,
        to: result.to_phase,
        forced: !!body.force,
      },
    });

    // Notifications push aux abonnés (lazy import pour rester optionnel)
    import("@/lib/projects/push")
      .then(({ notifyProjectPhaseChanged }) =>
        notifyProjectPhaseChanged({
          projectId: id,
          fromPhase: result.from_phase!,
          toPhase: result.to_phase!,
          actorUserId: guard.userId,
        }),
      )
      .catch((e) => console.error("[push] phase_changed:", e));

    // Pour cohérence avec la machine SQL : si on entre dans realisation
    // et qu'il n'y a aucune subvention sécurisée mais sans_subvention=true
    // (ou inversement), on log un audit pour traçabilité.
    if (result.to_phase === "realisation") {
      const service = await createServiceClient();
      const { data: p } = await service
        .from("projects")
        .select("sans_subvention")
        .eq("id", id)
        .maybeSingle();
      if (p?.sans_subvention) {
        await writeAudit({
          action: "project.realisation_sans_subvention",
          targetType: "project",
          targetId: id,
          communeId: guard.communeId,
        });
      }
    }
  }

  return NextResponse.json(result);
}
