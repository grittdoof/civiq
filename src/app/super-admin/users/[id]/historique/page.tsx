import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History, User as UserIcon } from "lucide-react";
import { getAuthContext } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// /super-admin/users/[id]/historique
//
// Historique chronologique de toutes les actions auditées initiées
// par un compte utilisateur (audit_log.actor_id = id).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string }>;
}

// Libellés humains pour les codes d'action de l'audit
const ACTION_LABELS: Record<string, { label: string; tone: "default" | "info" | "success" | "warning" | "danger" }> = {
  "ticket.assigned": { label: "Ticket assigné", tone: "info" },
  "ticket.unassigned": { label: "Ticket désassigné", tone: "default" },
  "ticket.reopened": { label: "Ticket rouvert", tone: "warning" },
  "ticket.closed": { label: "Ticket clôturé", tone: "success" },
  "ticket.resolved": { label: "Ticket résolu", tone: "success" },
  "ticket.updated": { label: "Ticket modifié", tone: "info" },
  "ticket.hard_deleted": { label: "Ticket supprimé définitivement", tone: "danger" },
  "survey.deleted": { label: "Sondage supprimé", tone: "danger" },
  "survey.published": { label: "Sondage publié", tone: "success" },
  "profile.role_changed": { label: "Rôle modifié", tone: "warning" },
  "module.activated": { label: "Module activé", tone: "success" },
  "module.deactivated": { label: "Module désactivé", tone: "default" },
};

function labelFor(action: string) {
  return ACTION_LABELS[action] ?? { label: action, tone: "default" as const };
}

const TONE_COLOR: Record<string, { bg: string; fg: string }> = {
  default: { bg: "#F3F4F6", fg: "#4B5563" },
  info:    { bg: "#DBEAFE", fg: "#1E40AF" },
  success: { bg: "#D1FAE5", fg: "#065F46" },
  warning: { bg: "#FEF3C7", fg: "#92400E" },
  danger:  { bg: "#FEE2E2", fg: "#991B1B" },
};

export default async function UserHistoryPage({ params, searchParams }: Props) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/auth/login");
  if (ctx.role !== "super_admin") redirect("/admin/dashboard");

  const { id } = await params;
  const sp = await searchParams;
  const limit = Math.min(parseInt(sp.limit ?? "200", 10) || 200, 1000);

  const service = await createServiceClient();

  // Queries séparées (plus fiables que les nested joins Supabase qui
  // peuvent échouer silencieusement si la relation n'est pas auto-résolue).
  const [profileRes, logsRes, profileEmailRes, orphanCountRes] = await Promise.all([
    service
      .from("profiles")
      .select("id, full_name, role, job_title, commune_id")
      .eq("id", id)
      .maybeSingle(),
    service
      .from("audit_log")
      .select(
        "id, action, target_type, target_id, metadata, created_at, actor_email, actor_role, commune_id",
        { count: "exact" },
      )
      .eq("actor_id", id)
      .order("created_at", { ascending: false })
      .limit(limit),
    // Email de l'utilisateur via auth.users (fallback si profile.full_name null)
    service.auth.admin.getUserById(id).catch(() => null),
    // Compte des logs orphelins (actor_id NULL) — vestige du bug RPC pour
    // info dans le bandeau si pertinent.
    service
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .is("actor_id", null),
  ]);

  if (profileRes.error) {
    console.error("[historique] profile error:", profileRes.error);
  }
  if (logsRes.error) {
    console.error("[historique] logs error:", logsRes.error);
  }

  const profile = profileRes.data;
  if (!profile) notFound();

  type ProfileRow = {
    id: string;
    full_name: string | null;
    role: string;
    job_title: string | null;
    commune_id: string | null;
  };
  const p = profile as ProfileRow;

  type LogRow = {
    id: number;
    action: string;
    target_type: string;
    target_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    actor_email: string | null;
    actor_role: string | null;
    commune_id: string | null;
  };
  const rows = (logsRes.data ?? []) as LogRow[];
  const count = logsRes.count;

  // Résolution séparée des noms de commune (une seule query batchée)
  const communeIds = Array.from(
    new Set(
      [p.commune_id, ...rows.map((r) => r.commune_id)].filter(
        (x): x is string => !!x,
      ),
    ),
  );
  let communeNames = new Map<string, string>();
  if (communeIds.length > 0) {
    const { data: communes } = await service
      .from("communes")
      .select("id, name")
      .in("id", communeIds);
    for (const c of communes ?? []) communeNames.set(c.id, c.name);
  }
  const userCommuneName = p.commune_id ? communeNames.get(p.commune_id) ?? null : null;

  // Email auth si full_name manquant
  const authEmail = profileEmailRes && "data" in profileEmailRes
    ? profileEmailRes.data?.user?.email ?? null
    : null;
  const displayName = p.full_name || authEmail || "(sans nom)";

  // Logs orphelins (actor_id NULL) — info contextuelle pour expliquer
  // pourquoi l'historique peut sembler vide pour les anciens logs.
  const orphanCount = orphanCountRes.count ?? 0;

  return (
    <main className="civiq-main" style={{ maxWidth: 960 }}>
      <Link
        href="/super-admin/users"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "var(--fg-muted)", textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} /> Utilisateurs
      </Link>

      <header style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--accent-light)", color: "var(--accent)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <History size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-muted)" }}>
              Historique des actions
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg)", margin: 0 }}>
              {displayName}
            </h1>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13, color: "var(--fg-muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <UserIcon size={13} /> Rôle : <strong style={{ color: "var(--fg)", fontWeight: 600 }}>{p.role}</strong>
          </span>
          {userCommuneName && (
            <span>· Commune : <strong style={{ color: "var(--fg)", fontWeight: 600 }}>{userCommuneName}</strong></span>
          )}
          <span>· {count ?? rows.length} action{(count ?? rows.length) > 1 ? "s" : ""} enregistrée{(count ?? rows.length) > 1 ? "s" : ""}</span>
          {count != null && count > rows.length && (
            <span>· Affichées : {rows.length} sur {count}</span>
          )}
        </div>
      </header>

      {orphanCount > 0 && (
        <div
          className="civiq-card"
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            background: "oklch(0.96 0.06 60)",
            borderColor: "oklch(0.78 0.10 60)",
            color: "oklch(0.32 0.10 60)",
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          <strong>Note :</strong> {orphanCount} entrée{orphanCount > 1 ? "s" : ""}
          d&apos;audit antérieure{orphanCount > 1 ? "s" : ""} ont un acteur non renseigné
          (vestige d&apos;un bug RPC corrigé). Elles n&apos;apparaissent dans l&apos;historique
          d&apos;aucun utilisateur. Les actions effectuées depuis le correctif sont
          correctement attribuées.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="civiq-card" style={{
          textAlign: "center", padding: "48px 24px",
          borderStyle: "dashed", color: "var(--fg-muted)",
        }}>
          <History size={32} style={{ margin: "0 auto 12px", color: "var(--fg-xmuted)" }} />
          <p style={{ fontSize: 14, color: "var(--fg)", marginBottom: 4 }}>
            Aucune action enregistrée
          </p>
          <p style={{ fontSize: 13, maxWidth: 380, margin: "0 auto" }}>
            Cet utilisateur n&apos;a effectué aucune action auditée depuis le
            correctif de l&apos;historique. Les actions à venir (création,
            modification, clôture, suppression de tickets…) seront tracées ici.
          </p>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Ligne verticale */}
          <span
            style={{
              position: "absolute",
              left: 11, top: 4, bottom: 4,
              width: 2,
              background: "var(--border)",
            }}
            aria-hidden
          />

          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {rows.map((r) => {
              const lbl = labelFor(r.action);
              const tone = TONE_COLOR[lbl.tone];
              const d = new Date(r.created_at);
              const dateStr = d.toLocaleDateString("fr-FR", {
                day: "2-digit", month: "short", year: "numeric",
              });
              const timeStr = d.toLocaleTimeString("fr-FR", {
                hour: "2-digit", minute: "2-digit",
              });

              return (
                <li key={r.id} style={{ position: "relative", paddingLeft: 36 }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 6, top: 14,
                      width: 12, height: 12, borderRadius: 999,
                      background: tone.fg, border: "3px solid var(--bg)",
                      zIndex: 1,
                    }}
                    aria-hidden
                  />
                  <div className="civiq-card" style={{ padding: "12px 16px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 12, flexWrap: "wrap", marginBottom: 6,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 99,
                          background: tone.bg, color: tone.fg,
                          fontSize: 11, fontWeight: 700,
                          letterSpacing: 0.02,
                        }}>
                          {lbl.label}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--fg-xmuted)" }}>
                          {r.action}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
                        {dateStr} · {timeStr}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, color: "var(--fg)" }}>
                      <span style={{ color: "var(--fg-muted)" }}>Cible : </span>
                      <strong>{r.target_type}</strong>
                      {r.target_id && (
                        <span style={{ color: "var(--fg-xmuted)", fontFamily: "ui-monospace, monospace", marginLeft: 6, fontSize: 11.5 }}>
                          {r.target_id.slice(0, 8)}…
                        </span>
                      )}
                      {r.commune_id && communeNames.get(r.commune_id) && (
                        <span style={{ marginLeft: 10, color: "var(--fg-muted)" }}>
                          · Commune : <strong style={{ color: "var(--fg)" }}>{communeNames.get(r.commune_id)}</strong>
                        </span>
                      )}
                    </div>

                    {r.metadata && Object.keys(r.metadata).length > 0 && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{
                          fontSize: 11, color: "var(--fg-muted)", cursor: "pointer",
                          userSelect: "none",
                        }}>
                          Détails
                        </summary>
                        <pre style={{
                          marginTop: 6,
                          padding: 10,
                          background: "var(--border-light)",
                          borderRadius: 6,
                          fontSize: 11.5,
                          lineHeight: 1.5,
                          color: "var(--fg)",
                          overflow: "auto",
                          maxHeight: 200,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}>{JSON.stringify(r.metadata, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {count != null && count > rows.length && (
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <Link
                href={`/super-admin/users/${id}/historique?limit=${Math.min(limit * 2, 1000)}`}
                className="civiq-btn civiq-btn-outline"
              >
                Charger {Math.min(limit, count - rows.length)} de plus
              </Link>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
