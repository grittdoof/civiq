import { getAuthContext } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// Audit log helper — à appeler depuis les Server Actions sur les
// actions sensibles (assignation, clôture, suppression, etc.).
//
// IMPORTANT : on N'UTILISE PAS la RPC log_audit() car elle se base
// sur auth.uid() qui retourne NULL sous service role → actor_id
// finissait NULL dans audit_log, rendant l'historique par
// utilisateur inutilisable.
//
// On lit l'utilisateur via getAuthContext() (session cookie) et on
// écrit directement dans audit_log via le service role (bypass RLS,
// non-bloquant). Snapshot des infos acteur pour résister à un
// éventuel oubli RGPD.
// ═══════════════════════════════════════════════════════════════

export interface AuditInput {
  /** Code action court : "ticket.assigned", "survey.deleted", "profile.role_changed"… */
  action: string;
  targetType: "ticket" | "survey" | "profile" | "commune" | "module" | "response" | "request" | string;
  targetId?: string | null;
  communeId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const ctx = await getAuthContext();
    const service = await createServiceClient();

    // Snapshot rôle/email pour conservation hors RGPD (utile si le profil
    // est supprimé plus tard).
    const { error } = await service.from("audit_log").insert({
      commune_id: input.communeId ?? ctx?.communeId ?? null,
      actor_id: ctx?.userId ?? null,
      actor_email: ctx?.email ?? null,
      actor_role: ctx?.role ?? null,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      metadata: input.metadata ?? null,
    });

    if (error) {
      console.error("[audit] insert failed:", error.message, input);
    }
  } catch (e) {
    console.error("[audit] exception:", e, input);
  }
}
