"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { CommissionMember, CommissionMemberRole } from "@/lib/projects/types";

interface Profile { id: string; full_name: string | null; job_title: string | null; }
type Row = CommissionMember & { profile: Profile | null };

interface Props {
  commissionId: string;
  initial: Row[];
  directory: Profile[];
  canEdit: boolean;
}

export default function CommissionMembersEditor({ commissionId, initial, directory, canEdit }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [pickId, setPickId] = useState("");
  const [role, setRole] = useState<CommissionMemberRole>("membre");

  async function add() {
    if (!pickId) return;
    const res = await fetch(`/api/commissions/${commissionId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: pickId, role }),
    });
    if (res.ok) {
      const { member } = (await res.json()) as { member: Row | null };
      if (member) setRows([...rows, member]);
      setPicking(false);
      setPickId("");
      router.refresh();
    }
  }

  async function remove(mid: string) {
    if (!confirm("Retirer ce membre ?")) return;
    const res = await fetch(`/api/commissions/${commissionId}/members/${mid}`, { method: "DELETE" });
    if (res.ok) {
      setRows(rows.filter((r) => r.id !== mid));
      router.refresh();
    }
  }

  const taken = new Set(rows.map((r) => r.user_id));
  const available = directory.filter((d) => !taken.has(d.id));

  return (
    <>
      {rows.length === 0 ? (
        <p className="pj-section-empty">Aucun membre. Ajoutez les conseillers municipaux.</p>
      ) : (
        <ul className="pj-subs">
          {rows.map((m) => (
            <li key={m.id} className="pj-sub-row">
              <span>
                {m.profile?.full_name ?? "—"}
                {m.role === "president" && (
                  <span className="civiq-badge civiq-badge-default" style={{ marginLeft: 6 }}>Président</span>
                )}
                {m.profile?.job_title && (
                  <span className="pj-table-sub" style={{ marginLeft: 6 }}>{m.profile.job_title}</span>
                )}
              </span>
              {canEdit && (
                <button type="button" onClick={() => remove(m.id)} className="civiq-icon-btn" aria-label="Retirer">
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        picking ? (
          <div className="pj-add-row">
            <select value={pickId} className="pj-input" onChange={(e) => setPickId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name ?? d.id} {d.job_title ? `(${d.job_title})` : ""}</option>
              ))}
            </select>
            <select value={role} className="pj-input" onChange={(e) => setRole(e.target.value as CommissionMemberRole)}>
              <option value="membre">Membre</option>
              <option value="president">Président</option>
            </select>
            <button type="button" onClick={add} disabled={!pickId} className="civiq-btn civiq-btn-default civiq-btn-sm">
              Ajouter
            </button>
            <button type="button" onClick={() => setPicking(false)} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
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
              <Plus size={14} /> Ajouter un membre
            </button>
          )
        )
      )}
    </>
  );
}
