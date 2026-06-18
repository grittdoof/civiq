"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Loader2 } from "lucide-react";

interface Props {
  ticketId: string;
  /** Si déjà transformé, on a l'id du projet pour rediriger */
  existingProjectId?: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Bouton « Transformer en projet » à insérer sur la page ticket.
// Si le ticket est déjà rattaché → lien direct vers le projet.
// ═══════════════════════════════════════════════════════════════

export default function TransformTicketButton({ ticketId, existingProjectId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingProjectId) {
    return (
      <a
        href={`/admin/projects/${existingProjectId}`}
        className="civiq-btn civiq-btn-outline civiq-btn-sm"
      >
        <FolderKanban size={14} /> Voir le projet rattaché
      </a>
    );
  }

  async function transform() {
    if (!confirm("Transformer ce ticket en projet d'investissement ?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/from-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const data = (await res.json()) as { project_id?: string; error?: string };
      if (!res.ok || !data.project_id) {
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      router.push(`/admin/projects/${data.project_id}/edit`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={transform}
        disabled={loading}
        className="civiq-btn civiq-btn-outline civiq-btn-sm"
      >
        {loading ? <Loader2 className="spin" size={14} /> : <FolderKanban size={14} />}
        Transformer en projet
      </button>
      {error && <span style={{ color: "var(--civiq-warning)", fontSize: 12 }}>{error}</span>}
    </>
  );
}
