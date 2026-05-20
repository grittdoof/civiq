"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, AlertCircle } from "lucide-react";
import { addTicketComment } from "@/lib/tickets/mutations";

// ═══════════════════════════════════════════════════════════════
// TicketCommentForm
//
// Formulaire d'ajout de commentaire libre dans la timeline.
// Affiché en bas de la liste des commentaires sur le détail.
// ═══════════════════════════════════════════════════════════════

export default function TicketCommentForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [contenu, setContenu] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!contenu.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addTicketComment(ticketId, contenu);
        setContenu("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="civiq-card" style={{ padding: 12, marginTop: 12 }}>
      {error && (
        <div style={{ display: "flex", gap: 6, padding: "6px 10px", background: "oklch(0.97 0.04 25)", border: "1px solid var(--destructive)", color: "var(--destructive)", borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}
      <textarea
        className="civiq-input civiq-textarea"
        rows={2}
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        placeholder="Ajouter une note ou un commentaire…"
        maxLength={5000}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--fg-xmuted)" }}>
          ⌘/Ctrl + Entrée pour envoyer
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !contenu.trim()}
          className="civiq-btn civiq-btn-default civiq-btn-sm"
        >
          {pending ? <Loader2 size={13} className="civiq-spin" /> : <Send size={13} />}
          Envoyer
        </button>
      </div>
    </div>
  );
}
