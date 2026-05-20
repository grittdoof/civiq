import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// Audit log helper — à appeler depuis les Server Actions sur les
// actions sensibles (assignation, clôture, suppression, etc.)
//
// Les écritures passent par le service role (bypass RLS) et sont
// non-bloquantes : un échec d'audit ne casse pas l'action métier.
// ═══════════════════════════════════════════════════════════════

export interface AuditInput {
  /** Code action court : "ticket.assigned", "survey.deleted", "profile.role_changed"… */
  action: string;
  targetType: "ticket" | "survey" | "profile" | "commune" | "module" | "response" | "request" | string;
  targetId?: string | null;
  communeId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Écrit une ligne dans audit_log via service role (jamais bloquant).
 * Récupère l'acteur via auth.uid() côté DB grâce à la fonction RPC.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const service = await createServiceClient();
    const { error } = await service.rpc("log_audit", {
      p_action: input.action,
      p_target_type: input.targetType,
      p_target_id: input.targetId ?? null,
      p_commune_id: input.communeId ?? null,
      p_metadata: input.metadata ?? null,
    });
    if (error) {
      console.error("[audit] insert failed:", error.message, input);
    }
  } catch (e) {
    console.error("[audit] exception:", e, input);
  }
}
