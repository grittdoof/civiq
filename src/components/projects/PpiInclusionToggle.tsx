"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, RotateCcw } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// PpiInclusionToggle — bouton inline pour exclure ou réintégrer
// un projet dans le PPI. Animation discrète + état pending.
//
// Variant "remove" : croix sur la ligne du tableau PPI.
// Variant "restore" : bouton "Réintégrer" dans la section des
// projets exclus.
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  variant: "remove" | "restore";
}

export default function PpiInclusionToggle({ projectId, variant }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ in_ppi: variant === "restore" }),
      });
      if (!res.ok) {
        setBusy(false);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setBusy(false);
    }
  }

  if (variant === "remove") {
    return (
      <button
        type="button"
        className="pj-ppi-remove-btn"
        onClick={toggle}
        disabled={busy}
        title="Retirer du PPI"
        aria-label="Retirer ce projet du PPI"
      >
        {busy ? <Loader2 size={13} className="spin" /> : <X size={13} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="civiq-btn civiq-btn-outline civiq-btn-sm"
      onClick={toggle}
      disabled={busy}
    >
      {busy ? <Loader2 size={12} className="spin" /> : <RotateCcw size={12} />}
      <span>Réintégrer</span>
    </button>
  );
}
