"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { ProjectSubscriber } from "@/lib/projects/types";

interface Profile { id: string; full_name: string | null; }
interface SubscriberRow extends ProjectSubscriber { profile: Profile | null; }

interface Props {
  projectId: string;
  initial: SubscriberRow[];
  /** Tous les agents/élus de la commune (annuaire) */
  directory: Profile[];
  currentUserId: string;
}

export default function SubscribersEditor({ projectId, initial, directory, currentUserId }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [pickId, setPickId] = useState("");

  async function add() {
    if (!pickId) return;
    const res = await fetch(`/api/projects/${projectId}/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: pickId }),
    });
    if (res.ok) {
      const prof = directory.find((d) => d.id === pickId) ?? null;
      setRows([
        ...rows,
        {
          id: crypto.randomUUID(),
          project_id: projectId,
          user_id: pickId,
          created_at: new Date().toISOString(),
          profile: prof,
        },
      ]);
      setPicking(false);
      setPickId("");
      router.refresh();
    }
  }

  async function remove(userId: string) {
    const res = await fetch(`/api/projects/${projectId}/subscribers/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setRows(rows.filter((r) => r.user_id !== userId));
      router.refresh();
    }
  }

  const subscribed = new Set(rows.map((r) => r.user_id));
  const available = directory.filter((d) => !subscribed.has(d.id));
  const meSubscribed = subscribed.has(currentUserId);

  return (
    <>
      {rows.length === 0 ? (
        <p className="pj-section-empty">Aucun abonné.</p>
      ) : (
        <ul className="pj-subs">
          {rows.map((s) => (
            <li key={s.id} className="pj-sub-row">
              <span>{s.profile?.full_name ?? "—"}</span>
              <button
                type="button"
                onClick={() => remove(s.user_id)}
                className="civiq-icon-btn"
                aria-label="Retirer"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!meSubscribed && (
        <button
          type="button"
          onClick={async () => {
            await fetch(`/api/projects/${projectId}/subscribers`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: currentUserId }),
            });
            router.refresh();
          }}
          className="civiq-btn civiq-btn-ghost civiq-btn-sm"
        >
          M&apos;abonner moi-même
        </button>
      )}

      {picking ? (
        <div className="pj-add-row">
          <select
            value={pickId}
            className="pj-input"
            onChange={(e) => setPickId(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name ?? d.id}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={add}
            disabled={!pickId}
            className="civiq-btn civiq-btn-default civiq-btn-sm"
          >
            Abonner
          </button>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="civiq-btn civiq-btn-ghost civiq-btn-sm"
          >
            Annuler
          </button>
        </div>
      ) : (
        available.length > 0 && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="civiq-btn civiq-btn-outline civiq-btn-sm pj-add-btn"
          >
            <Plus size={14} /> Ajouter un abonné
          </button>
        )
      )}
    </>
  );
}
