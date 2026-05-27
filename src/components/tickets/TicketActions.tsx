"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, FileEdit, Loader2, Lock,
  PencilLine, Trash2, X,
} from "lucide-react";
import { deleteTicketHard } from "@/lib/tickets/mutations";
import {
  GROUP_LABELS,
  GROUP_COLORS,
  STATUT_LABELS,
  groupOf,
  type TicketStatut,
  type TicketPriorite,
} from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// TicketActions — sidebar du détail ticket sur desktop.
//
// Cycle de vie simplifié : un ticket est Ouvert → seules 2 actions
// utilisateur existent :
//   • Clôturer + rédiger le rapport  (CTA principal, ce composant)
//   • Commenter le journal d'activité (champ inline dans la timeline,
//     hors de ce composant)
//
// Quand le ticket est clôturé, plus aucune action — juste un état
// informatif.
// ═══════════════════════════════════════════════════════════════

interface Props {
  ticketId: string;
  ticketNumero: number;
  statut: TicketStatut;
  // Conservés pour rétrocompat des appels existants — pas utilisés.
  priorite?: TicketPriorite;
  assigneId?: string | null;
  assigneeName?: string | null;
  assigneeIds?: string[];
  assigneeProfiles?: Array<{ id: string; full_name: string | null }>;
  canEdit: boolean;
  canAssign?: boolean;
  isSuperAdmin?: boolean;
  agents?: Array<{ id: string; full_name: string | null; job_title: string | null }>;
  hasReport: boolean;
}

export default function TicketActions({
  ticketId, ticketNumero, statut, canEdit, hasReport, isSuperAdmin,
}: Props) {
  const router = useRouter();
  const group = groupOf(statut);
  const isClosed = group === "cloture";
  const c = GROUP_COLORS[group];
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function hardDelete() {
    setConfirmDel(false);
    startTransition(async () => {
      try {
        await deleteTicketHard(ticketId);
        router.push("/admin/tickets");
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {err && (
        <div
          className="civiq-card"
          style={{
            background: "oklch(0.97 0.04 25)",
            border: "1px solid var(--destructive)",
            color: "var(--destructive)",
            fontSize: 13,
            padding: "8px 12px",
          }}
        >
          {err}
        </div>
      )}

      {/* CTA principal : ouvert → Clôturer + rapport */}
      {!isClosed && canEdit && (
        <Link
          href={`/admin/tickets/${ticketId}/cloturer`}
          className="civiq-btn civiq-btn-default"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {hasReport ? <FileEdit size={16} /> : <CheckCircle2 size={16} />}
          {hasReport ? "Modifier le rapport" : "Clôturer et rédiger le rapport"}
        </Link>
      )}

      {/* Modifier le ticket */}
      {canEdit && (
        <Link
          href={`/admin/tickets/${ticketId}/modifier`}
          className="civiq-btn civiq-btn-outline"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "10px 14px",
            fontSize: 13,
          }}
        >
          <PencilLine size={14} /> Modifier le ticket
        </Link>
      )}

      {/* État informatif quand clôturé */}
      {isClosed && (
        <div
          className="civiq-card"
          style={{
            padding: 14,
            display: "flex", alignItems: "center", gap: 10,
            background: c.bg,
            borderColor: c.fg,
          }}
        >
          <Lock size={16} style={{ color: c.fg, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: c.fg }}>
              {GROUP_LABELS[group]}
            </div>
            <div style={{ fontSize: 13, color: "var(--fg)", marginTop: 2 }}>
              {STATUT_LABELS[statut]}
            </div>
          </div>
        </div>
      )}

      {/* Aide pour le commentaire */}
      {!isClosed && canEdit && (
        <p
          style={{
            fontSize: 12, color: "var(--fg-muted)",
            lineHeight: 1.5, padding: "0 4px",
            margin: 0,
          }}
        >
          Chaque modification est tracée dans le journal d&apos;activité.
          Tu peux aussi ajouter un commentaire libre plus bas, sans clôturer.
        </p>
      )}

      {/* Zone danger : super-admin uniquement */}
      {isSuperAdmin && (
        <div
          className="civiq-card"
          style={{ padding: 12, borderColor: "var(--destructive)", borderStyle: "dashed", marginTop: 4 }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--destructive)" }}>
            Zone d&apos;administration
          </span>
          <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: "6px 0 10px", lineHeight: 1.5 }}>
            La suppression définitive efface le ticket et tous ses contenus liés.
          </p>
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            disabled={pending}
            className="civiq-btn civiq-btn-outline"
            style={{ width: "100%", justifyContent: "center", color: "var(--destructive)", borderColor: "var(--destructive)" }}
          >
            {pending ? <Loader2 size={14} className="civiq-spin" /> : <Trash2 size={14} />}
            Supprimer définitivement
          </button>
        </div>
      )}

      {confirmDel && (
        <DeleteConfirmModal
          ticketNumero={ticketNumero}
          pending={pending}
          onCancel={() => setConfirmDel(false)}
          onConfirm={hardDelete}
        />
      )}
    </div>
  );
}

function DeleteConfirmModal({
  ticketNumero, pending, onCancel, onConfirm,
}: {
  ticketNumero: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "oklch(0 0 0 / 0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      role="dialog" aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="civiq-card"
        style={{ width: "100%", maxWidth: 440, padding: 24 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 999,
            background: "oklch(0.95 0.07 25)", color: "var(--destructive)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <AlertTriangle size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>
              Supprimer le ticket #{ticketNumero} ?
            </h3>
            <p style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.5, marginTop: 6 }}>
              Photos, commentaires et rapport seront effacés. Action irréversible.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="civiq-icon-btn"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="civiq-btn civiq-btn-outline"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="civiq-btn civiq-btn-default"
            style={{ background: "var(--destructive)" }}
          >
            {pending ? <Loader2 size={14} className="civiq-spin" /> : <Trash2 size={14} />}
            Supprimer définitivement
          </button>
        </div>
      </div>
    </div>
  );
}
