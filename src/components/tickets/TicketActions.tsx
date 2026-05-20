"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PlayCircle, Pause, CheckCircle2, XCircle, RotateCcw,
  UserPlus, FileEdit, AlertCircle, Loader2, ChevronRight, Trash2,
} from "lucide-react";
import { updateTicketStatus, setTicketAssignees, updateTicketPriorite, deleteTicketHard } from "@/lib/tickets/mutations";
import {
  STATUT_LABELS, PRIORITE_LABELS, PRIORITE_COLORS,
  type TicketStatut, type TicketPriorite,
} from "@/lib/tickets/types";
import TicketAssignDialog from "./TicketAssignDialog";

// ═══════════════════════════════════════════════════════════════
// TicketActions
//
// Panneau d'actions affiché dans la sidebar du détail ticket.
// Affiche les transitions de statut autorisées contextuellement
// (selon le statut courant) + assignation + priorité inline.
// ═══════════════════════════════════════════════════════════════

interface Action {
  to: TicketStatut;
  label: string;
  icon: React.ReactNode;
  variant?: "primary" | "default" | "ghost";
  emphasis?: boolean;
}

function actionsFor(statut: TicketStatut): Action[] {
  switch (statut) {
    case "nouveau":
      return [
        { to: "pris_en_charge", label: "Prendre en charge", icon: <PlayCircle size={14} />, variant: "primary", emphasis: true },
        { to: "annule", label: "Annuler le ticket", icon: <XCircle size={14} />, variant: "ghost" },
      ];
    case "assigne":
      return [
        { to: "pris_en_charge", label: "Prendre en charge", icon: <PlayCircle size={14} />, variant: "primary", emphasis: true },
        { to: "annule", label: "Annuler le ticket", icon: <XCircle size={14} />, variant: "ghost" },
      ];
    case "pris_en_charge":
      return [
        { to: "en_cours", label: "Démarrer l'intervention", icon: <PlayCircle size={14} />, variant: "primary", emphasis: true },
        { to: "en_attente", label: "Mettre en pause", icon: <Pause size={14} />, variant: "default" },
        { to: "resolu", label: "Marquer résolu", icon: <CheckCircle2 size={14} />, variant: "default" },
      ];
    case "en_cours":
      return [
        { to: "resolu", label: "Marquer résolu", icon: <CheckCircle2 size={14} />, variant: "primary", emphasis: true },
        { to: "en_attente", label: "Mettre en pause", icon: <Pause size={14} />, variant: "default" },
      ];
    case "en_attente":
      return [
        { to: "en_cours", label: "Reprendre l'intervention", icon: <PlayCircle size={14} />, variant: "primary", emphasis: true },
        { to: "resolu", label: "Marquer résolu", icon: <CheckCircle2 size={14} />, variant: "default" },
      ];
    case "resolu":
      return [
        { to: "clos", label: "Clôturer définitivement", icon: <CheckCircle2 size={14} />, variant: "primary", emphasis: true },
        { to: "en_cours", label: "Réouvrir", icon: <RotateCcw size={14} />, variant: "ghost" },
      ];
    case "clos":
    case "annule":
      return [];
    default:
      return [];
  }
}

interface Props {
  ticketId: string;
  ticketNumero: number;
  statut: TicketStatut;
  priorite: TicketPriorite;
  assigneId: string | null;
  assigneeName: string | null;
  assigneeIds?: string[];                 // V2 : multi-assignés
  assigneeProfiles?: Array<{ id: string; full_name: string | null }>;
  canEdit: boolean;
  canAssign: boolean;
  isSuperAdmin?: boolean;                 // V2 : pour le hard delete
  agents: Array<{ id: string; full_name: string | null; job_title: string | null }>;
  hasReport: boolean;
}

export default function TicketActions({
  ticketId, ticketNumero, statut, priorite, assigneId, assigneeName,
  assigneeIds, assigneeProfiles,
  canEdit, canAssign, isSuperAdmin, agents, hasReport,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<TicketStatut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [editingPriorite, setEditingPriorite] = useState(false);

  const actions = actionsFor(statut);
  const showCloturerWizard = ["pris_en_charge", "en_cours", "en_attente"].includes(statut);

  function changeStatus(to: TicketStatut) {
    if (!canEdit) return;
    setError(null);
    setBusyAction(to);
    startTransition(async () => {
      try {
        await updateTicketStatus(ticketId, to);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setBusyAction(null);
      }
    });
  }

  function changePriorite(p: TicketPriorite) {
    setError(null);
    setEditingPriorite(false);
    startTransition(async () => {
      try {
        await updateTicketPriorite(ticketId, p);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function saveAssignees(profileIds: string[]) {
    setError(null);
    startTransition(async () => {
      try {
        await setTicketAssignees(ticketId, profileIds);
        setShowAssign(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function hardDelete() {
    if (!confirm(`Supprimer DÉFINITIVEMENT le ticket #${ticketNumero} ? Cette action est irréversible et efface aussi les photos, commentaires et rapport.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteTicketHard(ticketId);
        router.push("/admin/tickets");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  if (!canEdit && !canAssign) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {error && (
        <div style={{ display: "flex", gap: 6, padding: "8px 10px", background: "oklch(0.97 0.04 25)", border: "1px solid var(--destructive)", color: "var(--destructive)", borderRadius: "var(--radius-sm)", fontSize: 12 }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {/* CTA principal : wizard de clôture */}
      {canEdit && showCloturerWizard && (
        <Link
          href={`/admin/tickets/${ticketId}/cloturer`}
          className="civiq-btn civiq-btn-default"
          style={{ width: "100%", justifyContent: "center", padding: "10px 14px" }}
        >
          <FileEdit size={14} />
          {hasReport ? "Modifier le rapport" : "Rédiger le rapport et clôturer"}
        </Link>
      )}

      {/* Boutons de transition contextuels */}
      {canEdit && actions.length > 0 && (
        <div className="civiq-card" style={{ padding: 12, display: "grid", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 4 }}>
            Actions
          </div>
          {actions.map((a) => {
            const isBusy = busyAction === a.to;
            return (
              <button
                key={a.to}
                type="button"
                onClick={() => changeStatus(a.to)}
                disabled={pending}
                className={`civiq-btn ${
                  a.variant === "primary" ? "civiq-btn-default" :
                  a.variant === "ghost" ? "civiq-btn-ghost" : "civiq-btn-outline"
                }`}
                style={{ width: "100%", justifyContent: "flex-start", fontSize: 13 }}
              >
                {isBusy ? <Loader2 size={14} className="civiq-spin" /> : a.icon}
                <span style={{ flex: 1, textAlign: "left" }}>{a.label}</span>
                <ChevronRight size={12} style={{ opacity: 0.5 }} />
              </button>
            );
          })}
        </div>
      )}

      {/* Statut actuel (purement informatif si terminal) */}
      {actions.length === 0 && (
        <div className="civiq-card" style={{ padding: 12, fontSize: 12, color: "var(--fg-muted)" }}>
          Ticket en statut <strong style={{ color: "var(--fg)" }}>{STATUT_LABELS[statut]}</strong>.
          {statut === "clos" && " Aucune action possible."}
        </div>
      )}

      {/* Assignation (multi) */}
      {canAssign && (
        <div className="civiq-card" style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)" }}>
              Assignés
            </span>
            <button
              type="button"
              onClick={() => setShowAssign(true)}
              disabled={pending}
              className="civiq-btn civiq-btn-ghost civiq-btn-sm"
              style={{ padding: "3px 8px", fontSize: 12 }}
            >
              <UserPlus size={12} /> Modifier
            </button>
          </div>
          {assigneeProfiles && assigneeProfiles.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {assigneeProfiles.map((p) => (
                <span
                  key={p.id}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 8px", borderRadius: 99,
                    background: "var(--accent-light)", color: "var(--accent)",
                    fontSize: 12, fontWeight: 500,
                  }}
                  title={p.full_name ?? "—"}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: "var(--accent)", color: "#fff",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700,
                  }}>
                    {(p.full_name?.[0] ?? "?").toUpperCase()}
                  </span>
                  {p.full_name ?? "—"}
                </span>
              ))}
            </div>
          ) : assigneeName ? (
            <div style={{ fontSize: 13, color: "var(--fg)" }}>{assigneeName}</div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--fg-muted)", fontStyle: "italic" }}>Non assigné</div>
          )}
        </div>
      )}

      {/* Priorité inline */}
      {canEdit && (
        <div className="civiq-card" style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)" }}>
              Priorité
            </span>
            {!editingPriorite && (
              <button
                type="button"
                onClick={() => setEditingPriorite(true)}
                disabled={pending}
                className="civiq-btn civiq-btn-ghost civiq-btn-sm"
                style={{ padding: "3px 8px", fontSize: 12 }}
              >
                Modifier
              </button>
            )}
          </div>
          {editingPriorite ? (
            <div style={{ display: "grid", gap: 4 }}>
              {(["basse", "normale", "haute", "urgente"] as TicketPriorite[]).map((p) => {
                const c = PRIORITE_COLORS[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => changePriorite(p)}
                    disabled={pending}
                    className="civiq-btn civiq-btn-outline"
                    style={{
                      padding: "6px 10px", fontSize: 13, justifyContent: "flex-start",
                      borderColor: priorite === p ? c.fg : undefined,
                      background: priorite === p ? c.bg : undefined,
                      color: priorite === p ? c.fg : undefined,
                      fontWeight: priorite === p ? 600 : 500,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.fg, display: "inline-block" }} />
                    {PRIORITE_LABELS[p]}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setEditingPriorite(false)}
                className="civiq-btn civiq-btn-ghost civiq-btn-sm"
                style={{ marginTop: 4 }}
              >
                Annuler
              </button>
            </div>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITE_COLORS[priorite].fg }} />
              <strong style={{ color: "var(--fg)" }}>{PRIORITE_LABELS[priorite]}</strong>
            </div>
          )}
        </div>
      )}

      {/* Lien éditer (full form) */}
      {canEdit && (
        <Link
          href={`/admin/tickets/${ticketId}#edit`}
          style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", textAlign: "center", paddingTop: 6 }}
        >
          Ticket #{ticketNumero}
        </Link>
      )}

      {/* Zone danger : super-admin uniquement */}
      {isSuperAdmin && (
        <div
          className="civiq-card"
          style={{ padding: 12, borderColor: "var(--destructive)", borderStyle: "dashed" }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--destructive)" }}>
            Zone d&apos;administration
          </span>
          <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: "6px 0 10px", lineHeight: 1.5 }}>
            La suppression définitive efface le ticket et tous ses contenus liés (photos, commentaires, rapport).
          </p>
          <button
            type="button"
            onClick={hardDelete}
            disabled={pending}
            className="civiq-btn civiq-btn-outline"
            style={{ width: "100%", justifyContent: "center", color: "var(--destructive)", borderColor: "var(--destructive)" }}
          >
            <Trash2 size={14} /> Supprimer définitivement
          </button>
        </div>
      )}

      {showAssign && (
        <TicketAssignDialog
          currentAssigneId={assigneId}
          currentAssigneeIds={assigneeIds}
          agents={agents}
          onClose={() => setShowAssign(false)}
          onSave={saveAssignees}
          busy={pending}
        />
      )}
    </div>
  );
}
