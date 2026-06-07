"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, User, UserPlus } from "lucide-react";
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

  // Mode d'ajout : 'none' | 'internal' | 'external'
  const [addMode, setAddMode] = useState<"none" | "internal" | "external">("none");
  const [internal, setInternal] = useState({ user_id: "", role: "membre" as CommissionMemberRole });
  const [external, setExternal] = useState({
    name: "", email: "", phone: "",
    role: "membre" as CommissionMemberRole,
  });

  async function addInternal() {
    if (!internal.user_id) return;
    const res = await fetch(`/api/commissions/${commissionId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: internal.user_id, role: internal.role }),
    });
    if (res.ok) {
      const { member } = (await res.json()) as { member: Row | null };
      if (member) setRows([...rows, member]);
      setAddMode("none");
      setInternal({ user_id: "", role: "membre" });
      router.refresh();
    }
  }

  async function addExternal() {
    if (!external.name.trim()) return;
    const res = await fetch(`/api/commissions/${commissionId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        external_name: external.name.trim(),
        external_email: external.email.trim() || null,
        external_phone: external.phone.trim() || null,
        role: external.role,
      }),
    });
    if (res.ok) {
      const { member } = (await res.json()) as { member: Row | null };
      if (member) setRows([...rows, member]);
      setAddMode("none");
      setExternal({ name: "", email: "", phone: "", role: "membre" });
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

  // user_ids déjà internes pour cacher de la liste
  const takenUserIds = new Set(rows.map((r) => r.user_id).filter((u): u is string => !!u));
  const availableProfiles = directory.filter((d) => !takenUserIds.has(d.id));

  function memberDisplayName(m: Row): string {
    if (m.profile?.full_name) return m.profile.full_name;
    if (m.external_name) return m.external_name;
    return "—";
  }

  return (
    <>
      {rows.length === 0 ? (
        <p className="pj-section-empty">Aucun membre. Ajoutez les conseillers municipaux et les éventuels invités externes.</p>
      ) : (
        <ul className="pj-subs">
          {rows.map((m) => {
            const isExternal = !m.user_id;
            return (
              <li key={m.id} className="pj-sub-row">
                <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <span title={isExternal ? "Membre externe (sans compte GoCiviq)" : "Membre interne"}>
                    {isExternal ? <UserPlus size={14} /> : <User size={14} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {memberDisplayName(m)}
                    {m.role === "president" && (
                      <span className="civiq-badge civiq-badge-default" style={{ marginLeft: 6 }}>Président</span>
                    )}
                    {isExternal && (
                      <span className="civiq-badge civiq-badge-muted" style={{ marginLeft: 6 }}>Externe</span>
                    )}
                    {(m.profile?.job_title || m.external_email) && (
                      <div className="pj-table-sub" style={{ marginTop: 1 }}>
                        {m.profile?.job_title}
                        {m.external_email}
                      </div>
                    )}
                  </span>
                </span>
                {canEdit && (
                  <button type="button" onClick={() => remove(m.id)} className="civiq-icon-btn" aria-label="Retirer">
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && addMode === "none" && (
        <div className="pj-add-actions">
          <button
            type="button"
            onClick={() => setAddMode("internal")}
            className="civiq-btn civiq-btn-outline civiq-btn-sm"
          >
            <Plus size={14} /> Ajouter un conseiller (compte GoCiviq)
          </button>
          <button
            type="button"
            onClick={() => setAddMode("external")}
            className="civiq-btn civiq-btn-ghost civiq-btn-sm"
          >
            <UserPlus size={14} /> Ajouter un membre externe
          </button>
        </div>
      )}

      {canEdit && addMode === "internal" && (
        <div className="pj-add-row">
          <select
            value={internal.user_id}
            className="pj-input"
            onChange={(e) => setInternal({ ...internal, user_id: e.target.value })}
          >
            <option value="">— Sélectionner —</option>
            {availableProfiles.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name ?? d.id} {d.job_title ? `(${d.job_title})` : ""}
              </option>
            ))}
          </select>
          <select
            value={internal.role}
            className="pj-input"
            onChange={(e) => setInternal({ ...internal, role: e.target.value as CommissionMemberRole })}
          >
            <option value="membre">Membre</option>
            <option value="president">Président</option>
          </select>
          <button
            type="button"
            onClick={addInternal}
            disabled={!internal.user_id}
            className="civiq-btn civiq-btn-default civiq-btn-sm"
          >
            Ajouter
          </button>
          <button type="button" onClick={() => setAddMode("none")} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
            Annuler
          </button>
        </div>
      )}

      {canEdit && addMode === "external" && (
        <div className="pj-add-form">
          <input
            placeholder="Nom complet *"
            className="pj-input"
            value={external.name}
            onChange={(e) => setExternal({ ...external, name: e.target.value })}
          />
          <input
            placeholder="Email (facultatif)"
            type="email"
            className="pj-input"
            value={external.email}
            onChange={(e) => setExternal({ ...external, email: e.target.value })}
          />
          <input
            placeholder="Téléphone (facultatif)"
            className="pj-input"
            value={external.phone}
            onChange={(e) => setExternal({ ...external, phone: e.target.value })}
          />
          <select
            value={external.role}
            className="pj-input"
            onChange={(e) => setExternal({ ...external, role: e.target.value as CommissionMemberRole })}
          >
            <option value="membre">Membre</option>
            <option value="president">Président</option>
          </select>
          <div className="pj-add-form-actions">
            <button
              type="button"
              onClick={addExternal}
              disabled={!external.name.trim()}
              className="civiq-btn civiq-btn-default civiq-btn-sm"
            >
              Ajouter ce membre externe
            </button>
            <button type="button" onClick={() => setAddMode("none")} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}
