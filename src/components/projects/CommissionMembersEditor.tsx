"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserCheck } from "lucide-react";
import type { CommissionMember, CommissionMemberRole } from "@/lib/projects/types";

interface Profile { id: string; full_name: string | null; job_title: string | null; }
type Row = CommissionMember & { profile: Profile | null };

interface Props {
  commissionId: string;
  initial: Row[];
  directory: Profile[];
  canEdit: boolean;
}

// ═══════════════════════════════════════════════════════════════
// CommissionMembersEditor — Un seul formulaire d'ajout.
//
// Un membre de commission est un conseiller municipal. Selon les
// communes il a un compte GoCiviq ou non. On ne distingue pas les
// onglets « interne / externe » : on coche simplement « Sans
// compte GoCiviq » quand on veut saisir le nom à la main.
// ═══════════════════════════════════════════════════════════════

export default function CommissionMembersEditor({ commissionId, initial, directory, canEdit }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [noAccount, setNoAccount] = useState(false);

  // Form fields (unifiés)
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<CommissionMemberRole>("membre");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAdding(false);
    setNoAccount(false);
    setUserId("");
    setName("");
    setEmail("");
    setPhone("");
    setRole("membre");
    setError(null);
  }

  async function add() {
    setError(null);
    const body: Record<string, unknown> = { role };
    if (noAccount) {
      if (!name.trim()) {
        setError("Le nom du conseiller est obligatoire");
        return;
      }
      body.external_name = name.trim();
      body.external_email = email.trim() || null;
      body.external_phone = phone.trim() || null;
    } else {
      if (!userId) {
        setError("Sélectionnez un conseiller dans la liste");
        return;
      }
      body.user_id = userId;
    }

    const res = await fetch(`/api/commissions/${commissionId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const { member } = (await res.json()) as { member: Row | null };
      if (member) setRows([...rows, member]);
      reset();
      router.refresh();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Erreur");
    }
  }

  async function remove(mid: string) {
    if (!confirm("Retirer ce conseiller ?")) return;
    const res = await fetch(`/api/commissions/${commissionId}/members/${mid}`, { method: "DELETE" });
    if (res.ok) {
      setRows(rows.filter((r) => r.id !== mid));
      router.refresh();
    }
  }

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
        <p className="pj-section-empty">Aucun conseiller dans cette commission.</p>
      ) : (
        <ul className="pj-subs">
          {rows.map((m) => {
            const noAcc = !m.user_id;
            return (
              <li key={m.id} className="pj-sub-row">
                <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <UserCheck size={14} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{memberDisplayName(m)}</span>
                    {m.role === "president" && (
                      <span className="civiq-badge civiq-badge-default" style={{ marginLeft: 6 }}>Président·e</span>
                    )}
                    {m.role === "vice_president" && (
                      <span className="civiq-badge civiq-badge-default" style={{ marginLeft: 6 }}>Vice-président·e</span>
                    )}
                    {noAcc && (
                      <span className="civiq-badge civiq-badge-muted" style={{ marginLeft: 6 }}>
                        Sans compte GoCiviq
                      </span>
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

      {canEdit && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="civiq-btn civiq-btn-outline civiq-btn-sm pj-add-btn"
        >
          <Plus size={14} /> Ajouter un conseiller
        </button>
      )}

      {canEdit && adding && (
        <div className="pj-add-form">
          {/* Toggle compte / pas de compte */}
          <label className="pj-checkbox" style={{ gridColumn: "1 / -1" }}>
            <input
              type="checkbox"
              checked={noAccount}
              onChange={(e) => setNoAccount(e.target.checked)}
            />
            <span>Ce conseiller n&apos;a pas de compte GoCiviq</span>
          </label>

          {!noAccount ? (
            <select
              value={userId}
              className="pj-input"
              style={{ gridColumn: "1 / -1" }}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">— Sélectionner dans l&apos;annuaire commune —</option>
              {availableProfiles.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name ?? d.id}{d.job_title ? ` (${d.job_title})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                placeholder="Nom complet *"
                className="pj-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                placeholder="Email (facultatif)"
                type="email"
                className="pj-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                placeholder="Téléphone (facultatif)"
                className="pj-input"
                style={{ gridColumn: "1 / -1" }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </>
          )}

          <select
            value={role}
            className="pj-input"
            style={{ gridColumn: "1 / -1" }}
            onChange={(e) => setRole(e.target.value as CommissionMemberRole)}
          >
            <option value="membre">Rôle : Membre</option>
            <option value="vice_president">Rôle : Vice-président·e</option>
            <option value="president">Rôle : Président·e</option>
          </select>

          {error && (
            <div className="pj-modal-error" style={{ gridColumn: "1 / -1" }}>
              {error}
            </div>
          )}

          <div className="pj-add-form-actions">
            <button type="button" onClick={add} className="civiq-btn civiq-btn-default civiq-btn-sm">
              Ajouter le conseiller
            </button>
            <button type="button" onClick={reset} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}
