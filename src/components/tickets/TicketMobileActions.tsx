"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileEdit,
  Loader2,
  MoreHorizontal,
  PencilLine,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { deleteTicketHard, reopenTicket } from "@/lib/tickets/mutations";
import { groupOf, type TicketStatut } from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// Barre d'actions mobile pour le détail ticket.
//
// Cycle simplifié :
//   • Si OUVERT : CTA primaire = « Clôturer + rapport », bouton « ⋯ »
//     ouvre un menu (Modifier / Clôturer / [super-admin: Supprimer]).
//   • Si CLÔTURÉ : la barre est masquée sauf pour le super-admin qui
//     conserve l'accès au menu (pour supprimer définitivement).
// ═══════════════════════════════════════════════════════════════

interface Props {
  ticketId: string;
  ticketNumero: number;
  statut: TicketStatut;
  canEdit: boolean;
  isSuperAdmin?: boolean;
  hasReport: boolean;
}

export default function TicketMobileActions({
  ticketId, ticketNumero, statut, canEdit, isSuperAdmin, hasReport,
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const isClosed = groupOf(statut) === "cloture";

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function hardDelete() {
    setDeleteOpen(false);
    setMenuOpen(false);
    startTransition(async () => {
      try {
        await deleteTicketHard(ticketId);
        router.push("/admin/tickets");
        router.refresh();
      } catch (e) {
        setToast({ kind: "err", text: e instanceof Error ? e.message : "Erreur" });
      }
    });
  }

  function reopen() {
    setMenuOpen(false);
    startTransition(async () => {
      try {
        await reopenTicket(ticketId);
        setToast({ kind: "ok", text: "Ticket rouvert" });
        router.refresh();
      } catch (e) {
        setToast({ kind: "err", text: e instanceof Error ? e.message : "Erreur" });
      }
    });
  }

  // Caché uniquement si l'utilisateur n'a rien à faire :
  //   - ni édition (création/modif/clôture/réouverture)
  //   - ni super-admin (suppression)
  if (!canEdit && !isSuperAdmin) return null;

  return (
    <>
      <div className="tk-mobile-actions" aria-label="Actions du ticket">
        <Link
          href="/admin/tickets"
          className="tk-mobile-actions-back"
          aria-label="Retour à la liste des tickets"
        >
          <ArrowLeft size={20} />
        </Link>
        {!isClosed && canEdit && (
          <Link
            href={`/admin/tickets/${ticketId}/cloturer`}
            className="civiq-btn civiq-btn-default tk-mobile-actions-primary"
          >
            {hasReport ? <FileEdit size={18} /> : <CheckCircle2 size={18} />}
            <span>{hasReport ? "Modifier le rapport" : "Clôturer + rapport"}</span>
          </Link>
        )}
        {isClosed && canEdit && (
          <button
            type="button"
            onClick={reopen}
            disabled={pending}
            className="civiq-btn civiq-btn-outline tk-mobile-actions-primary"
          >
            {pending ? <Loader2 size={18} className="civiq-spin" /> : <RotateCcw size={18} />}
            <span>Rouvrir le ticket</span>
          </button>
        )}
        {isClosed && !canEdit && (
          <div className="tk-mobile-actions-status" aria-live="polite">
            <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
            <strong>Ticket clôturé</strong>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="tk-mobile-actions-more"
          aria-label="Menu du ticket"
          aria-haspopup="dialog"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {menuOpen && (
        <ActionsMenuSheet
          ticketId={ticketId}
          ticketNumero={ticketNumero}
          isClosed={isClosed}
          canEdit={canEdit}
          isSuperAdmin={!!isSuperAdmin}
          hasReport={hasReport}
          onClose={() => setMenuOpen(false)}
          onReopen={reopen}
          onAskDelete={() => {
            setMenuOpen(false);
            setDeleteOpen(true);
          }}
        />
      )}

      {deleteOpen && (
        <DeleteConfirm
          ticketNumero={ticketNumero}
          pending={pending}
          onCancel={() => setDeleteOpen(false)}
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

// ─── Menu sheet ──────────────────────────────────────────────────

function ActionsMenuSheet({
  ticketId, ticketNumero, isClosed, canEdit, isSuperAdmin, hasReport,
  onClose, onReopen, onAskDelete,
}: {
  ticketId: string;
  ticketNumero: number;
  isClosed: boolean;
  canEdit: boolean;
  isSuperAdmin: boolean;
  hasReport: boolean;
  onClose: () => void;
  onReopen: () => void;
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
          {canEdit && (
            <SheetSection title="Modification">
              <Link
                href={`/admin/tickets/${ticketId}/modifier`}
                className="tk-sheet-row"
                onClick={onClose}
              >
                <span className="tk-sheet-row-icon"><PencilLine size={16} /></span>
                <span className="tk-sheet-row-label">Modifier le ticket</span>
                <ChevronRight size={14} style={{ opacity: 0.5 }} />
              </Link>
              <p style={{ fontSize: 11, color: "var(--fg-muted)", padding: "8px 6px 0", lineHeight: 1.5, margin: 0 }}>
                Chaque modification est tracée dans le journal d&apos;activité.
              </p>
            </SheetSection>
          )}

          {!isClosed && canEdit && (
            <SheetSection title="Clôture">
              <Link
                href={`/admin/tickets/${ticketId}/cloturer`}
                className="tk-sheet-row"
                onClick={onClose}
              >
                <span className="tk-sheet-row-icon"><CheckCircle2 size={16} /></span>
                <span className="tk-sheet-row-label">
                  {hasReport ? "Modifier le rapport" : "Clôturer et rédiger le rapport"}
                </span>
                <ChevronRight size={14} style={{ opacity: 0.5 }} />
              </Link>
            </SheetSection>
          )}

          {isClosed && canEdit && (
            <SheetSection title="Réouverture">
              <button
                type="button"
                onClick={onReopen}
                className="tk-sheet-row"
              >
                <span className="tk-sheet-row-icon"><RotateCcw size={16} /></span>
                <span className="tk-sheet-row-label">Rouvrir le ticket</span>
              </button>
              <p style={{ fontSize: 11, color: "var(--fg-muted)", padding: "8px 6px 0", lineHeight: 1.5, margin: 0 }}>
                La réouverture est enregistrée dans le journal d&apos;activité.
              </p>
            </SheetSection>
          )}

          {isSuperAdmin && (
            <SheetSection title="Zone d'administration" tone="danger">
              <button
                type="button"
                onClick={onAskDelete}
                className="tk-sheet-row"
                data-tone="danger"
              >
                <span className="tk-sheet-row-icon"><Trash2 size={16} /></span>
                <span className="tk-sheet-row-label">Supprimer définitivement</span>
              </button>
              <p style={{ fontSize: 11, color: "var(--fg-muted)", padding: "8px 6px 0", lineHeight: 1.5, margin: 0 }}>
                Action irréversible : photos, commentaires et rapport seront effacés.
              </p>
            </SheetSection>
          )}
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
            {pending ? <Loader2 size={14} className="civiq-spin" /> : <Trash2 size={14} />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
