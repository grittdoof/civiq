"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  FileEdit,
  Loader2,
  MoreHorizontal,
  Pause,
  PlayCircle,
  RotateCcw,
  Trash2,
  UserPlus,
  XCircle,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  deleteTicketHard,
  setTicketAssignees,
  updateTicketPriorite,
  updateTicketStatus,
} from "@/lib/tickets/mutations";
import {
  PRIORITE_COLORS,
  PRIORITE_LABELS,
  STATUT_LABELS,
  type TicketPriorite,
  type TicketStatut,
} from "@/lib/tickets/types";
import TicketAssignDialog from "./TicketAssignDialog";

// ═══════════════════════════════════════════════════════════════
// Barre d'actions mobile pour le détail ticket.
// Sticky bas, CTA primaire contextuel au statut. Bouton "Plus"
// ouvre une bottom sheet avec les actions secondaires.
// Optimistic UI sur changement de statut.
// Visible uniquement < 900px (cf. .tk-detail-grid media query).
// ═══════════════════════════════════════════════════════════════

interface Props {
  ticketId: string;
  ticketNumero: number;
  statut: TicketStatut;
  priorite: TicketPriorite;
  assigneId: string | null;
  assigneeIds?: string[];
  agents: Array<{ id: string; full_name: string | null; job_title: string | null }>;
  canEdit: boolean;
  canAssign: boolean;
  isSuperAdmin?: boolean;
  hasReport: boolean;
}

interface PrimaryAction {
  label: string;
  to: TicketStatut;
  icon: React.ReactNode;
}

interface SecondaryAction {
  label: string;
  to: TicketStatut;
  icon: React.ReactNode;
  tone?: "default" | "danger";
}

function primaryFor(statut: TicketStatut): PrimaryAction | null {
  switch (statut) {
    case "nouveau":
    case "assigne":
      return { label: "Prendre en charge", to: "pris_en_charge", icon: <PlayCircle size={18} /> };
    case "pris_en_charge":
      return { label: "Démarrer l'intervention", to: "en_cours", icon: <PlayCircle size={18} /> };
    case "en_cours":
      return { label: "Marquer résolu", to: "resolu", icon: <CheckCircle2 size={18} /> };
    case "en_attente":
      return { label: "Reprendre", to: "en_cours", icon: <PlayCircle size={18} /> };
    case "resolu":
      return { label: "Clôturer définitivement", to: "clos", icon: <CheckCircle2 size={18} /> };
    default:
      return null;
  }
}

function secondariesFor(statut: TicketStatut): SecondaryAction[] {
  switch (statut) {
    case "nouveau":
    case "assigne":
      return [
        { label: "Annuler le ticket", to: "annule", icon: <XCircle size={16} />, tone: "danger" },
      ];
    case "pris_en_charge":
      return [
        { label: "Mettre en pause", to: "en_attente", icon: <Pause size={16} /> },
        { label: "Marquer résolu", to: "resolu", icon: <CheckCircle2 size={16} /> },
      ];
    case "en_cours":
      return [
        { label: "Mettre en pause", to: "en_attente", icon: <Pause size={16} /> },
      ];
    case "en_attente":
      return [
        { label: "Marquer résolu", to: "resolu", icon: <CheckCircle2 size={16} /> },
      ];
    case "resolu":
      return [
        { label: "Réouvrir", to: "en_cours", icon: <RotateCcw size={16} /> },
      ];
    default:
      return [];
  }
}

export default function TicketMobileActions({
  ticketId, ticketNumero, statut, priorite, assigneId, assigneeIds,
  agents, canEdit, canAssign, isSuperAdmin, hasReport,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [optimisticStatut, applyOptimisticStatut] = useOptimistic(
    statut,
    (_state, next: TicketStatut) => next,
  );
  const [optimisticPriorite, applyOptimisticPriorite] = useOptimistic(
    priorite,
    (_state, next: TicketPriorite) => next,
  );

  const primary = primaryFor(optimisticStatut);
  const secondaries = secondariesFor(optimisticStatut);
  const isClosed = ["clos", "annule"].includes(optimisticStatut);
  const showReportCta = ["pris_en_charge", "en_cours", "en_attente"].includes(optimisticStatut);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
  }

  function changeStatus(to: TicketStatut) {
    if (!canEdit) return;
    setSheetOpen(false);
    startTransition(async () => {
      applyOptimisticStatut(to);
      try {
        await updateTicketStatus(ticketId, to);
        showToast("ok", `Statut → ${STATUT_LABELS[to]}`);
        router.refresh();
      } catch (e) {
        showToast("err", e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function changePriorite(p: TicketPriorite) {
    startTransition(async () => {
      applyOptimisticPriorite(p);
      try {
        await updateTicketPriorite(ticketId, p);
        showToast("ok", `Priorité → ${PRIORITE_LABELS[p]}`);
        router.refresh();
      } catch (e) {
        showToast("err", e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function saveAssignees(ids: string[]) {
    startTransition(async () => {
      try {
        await setTicketAssignees(ticketId, ids);
        setShowAssign(false);
        showToast("ok", "Assignation mise à jour");
        router.refresh();
      } catch (e) {
        showToast("err", e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function hardDelete() {
    setShowDeleteConfirm(false);
    setSheetOpen(false);
    startTransition(async () => {
      try {
        await deleteTicketHard(ticketId);
        router.push("/admin/tickets");
        router.refresh();
      } catch (e) {
        showToast("err", e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  if (!canEdit && !canAssign) return null;
  if (isClosed && !isSuperAdmin) return null;

  return (
    <>
      <div className="tk-mobile-actions" aria-label="Actions du ticket">
        {showReportCta && canEdit && (
          <Link
            href={`/admin/tickets/${ticketId}/cloturer`}
            className="civiq-btn civiq-btn-outline tk-mobile-actions-report"
            aria-label={hasReport ? "Modifier le rapport" : "Rédiger le rapport"}
          >
            <FileEdit size={18} />
            <span className="tk-mobile-actions-report-label">
              {hasReport ? "Rapport" : "Rapport"}
            </span>
          </Link>
        )}
        {primary && canEdit ? (
          <button
            type="button"
            onClick={() => changeStatus(primary.to)}
            disabled={pending}
            className="civiq-btn civiq-btn-default tk-mobile-actions-primary"
          >
            {pending ? <Loader2 size={18} className="civiq-spin" /> : primary.icon}
            <span>{primary.label}</span>
          </button>
        ) : (
          <div className="tk-mobile-actions-status">
            <span>Statut</span>
            <strong>{STATUT_LABELS[optimisticStatut]}</strong>
          </div>
        )}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="tk-mobile-actions-more"
          aria-label="Plus d'actions"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {sheetOpen && (
        <ActionsSheet
          ticketNumero={ticketNumero}
          statut={optimisticStatut}
          priorite={optimisticPriorite}
          secondaries={secondaries}
          canEdit={canEdit}
          canAssign={canAssign}
          isSuperAdmin={isSuperAdmin}
          pending={pending}
          onClose={() => setSheetOpen(false)}
          onChangeStatus={changeStatus}
          onChangePriorite={changePriorite}
          onOpenAssign={() => {
            setSheetOpen(false);
            setShowAssign(true);
          }}
          onAskDelete={() => {
            setSheetOpen(false);
            setShowDeleteConfirm(true);
          }}
        />
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

      {showDeleteConfirm && (
        <DeleteConfirm
          ticketNumero={ticketNumero}
          pending={pending}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={hardDelete}
        />
      )}

      {toast && (
        <div className={`tk-toast tk-toast-${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}
    </>
  );
}

// ─── Actions sheet ───────────────────────────────────────────────

function ActionsSheet({
  ticketNumero, statut, priorite, secondaries,
  canEdit, canAssign, isSuperAdmin, pending,
  onClose, onChangeStatus, onChangePriorite, onOpenAssign, onAskDelete,
}: {
  ticketNumero: number;
  statut: TicketStatut;
  priorite: TicketPriorite;
  secondaries: SecondaryAction[];
  canEdit: boolean;
  canAssign: boolean;
  isSuperAdmin?: boolean;
  pending: boolean;
  onClose: () => void;
  onChangeStatus: (s: TicketStatut) => void;
  onChangePriorite: (p: TicketPriorite) => void;
  onOpenAssign: () => void;
  onAskDelete: () => void;
}) {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div className="tk-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tk-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tk-sheet-handle" />
        <div className="tk-sheet-header">
          <h3>Actions · #{ticketNumero}</h3>
          <button type="button" onClick={onClose} className="tk-wizard-iconbtn" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="tk-sheet-body">
          {canEdit && secondaries.length > 0 && (
            <SheetSection title="Changer de statut">
              {secondaries.map((s) => (
                <button
                  key={s.to}
                  type="button"
                  onClick={() => onChangeStatus(s.to)}
                  disabled={pending}
                  className="tk-sheet-row"
                  data-tone={s.tone ?? "default"}
                >
                  <span className="tk-sheet-row-icon">{s.icon}</span>
                  <span className="tk-sheet-row-label">{s.label}</span>
                  <ChevronRight size={14} style={{ opacity: 0.5 }} />
                </button>
              ))}
            </SheetSection>
          )}

          {canEdit && (
            <SheetSection title="Priorité">
              <div className="tk-sheet-priorites">
                {(["basse", "normale", "haute", "urgente"] as TicketPriorite[]).map((p) => {
                  const c = PRIORITE_COLORS[p];
                  const active = priorite === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onChangePriorite(p)}
                      disabled={pending}
                      aria-pressed={active}
                      className="tk-sheet-priorite"
                      data-active={active}
                      style={active ? { borderColor: c.fg, background: c.bg, color: c.fg } : undefined}
                    >
                      <span
                        style={{
                          width: 10, height: 10, borderRadius: 999,
                          background: c.fg, display: "inline-block",
                        }}
                      />
                      {PRIORITE_LABELS[p]}
                    </button>
                  );
                })}
              </div>
            </SheetSection>
          )}

          {canAssign && (
            <SheetSection title="Assignation">
              <button
                type="button"
                onClick={onOpenAssign}
                disabled={pending}
                className="tk-sheet-row"
              >
                <span className="tk-sheet-row-icon"><UserPlus size={16} /></span>
                <span className="tk-sheet-row-label">Modifier les assignés</span>
                <ChevronRight size={14} style={{ opacity: 0.5 }} />
              </button>
            </SheetSection>
          )}

          {isSuperAdmin && (
            <SheetSection title="Zone d'administration" tone="danger">
              <button
                type="button"
                onClick={onAskDelete}
                disabled={pending}
                className="tk-sheet-row"
                data-tone="danger"
              >
                <span className="tk-sheet-row-icon"><Trash2 size={16} /></span>
                <span className="tk-sheet-row-label">Supprimer définitivement</span>
              </button>
            </SheetSection>
          )}

          <p style={{ fontSize: 11, color: "var(--fg-muted)", textAlign: "center", marginTop: 16 }}>
            Statut actuel : <strong style={{ color: "var(--fg)" }}>{STATUT_LABELS[statut]}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function SheetSection({
  title, tone, children,
}: {
  title: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div className="tk-sheet-section">
      <div className="tk-sheet-section-title" data-tone={tone ?? "default"}>{title}</div>
      <div className="tk-sheet-section-body">{children}</div>
    </div>
  );
}

// ─── Delete confirm ──────────────────────────────────────────────

function DeleteConfirm({
  ticketNumero, pending, onCancel, onConfirm,
}: {
  ticketNumero: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="tk-sheet-backdrop" onClick={onCancel} role="dialog" aria-modal="true">
      <div
        className="tk-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420, margin: "auto" }}
      >
        <div className="tk-sheet-handle" />
        <div className="tk-sheet-body" style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 999,
            background: "oklch(0.95 0.07 25)", color: "var(--destructive)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <AlertTriangle size={28} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            Supprimer le ticket #{ticketNumero} ?
          </h3>
          <p style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            Photos, commentaires et rapport seront effacés. Action irréversible.
          </p>
        </div>
        <div className="tk-sheet-footer" style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="civiq-btn civiq-btn-outline"
            style={{ flex: 1, justifyContent: "center" }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="civiq-btn civiq-btn-default"
            style={{
              flex: 1, justifyContent: "center",
              background: "var(--destructive)",
            }}
          >
            <Trash2 size={14} /> Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
