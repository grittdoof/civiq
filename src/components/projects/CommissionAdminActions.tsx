"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { COMMISSION_COLOR_PALETTE, COMMISSION_ICONS, type CommissionIconName } from "@/lib/projects/types";
import CommissionIcon from "./CommissionIcon";

interface Profile { id: string; full_name: string | null; }

interface Initial {
  nom: string;
  description: string | null;
  responsable_user_id: string | null;
  color: string;
  icon: string;
  active: boolean;
}

interface Props {
  commissionId: string;
  initial: Initial;
  profiles: Profile[];
  canEdit: boolean;
  canDelete: boolean;
}

// ═══════════════════════════════════════════════════════════════
// CommissionAdminActions — boutons « Modifier » et « Supprimer »
// + dialog d'édition complet (mêmes champs que la création).
//
// Affiché dans l'en-tête de la page commission, conditionné par
// les flags canEdit / canDelete (visibilité côté serveur).
// ═══════════════════════════════════════════════════════════════

export default function CommissionAdminActions({
  commissionId, initial, profiles, canEdit, canDelete,
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [nom, setNom] = useState(initial.nom);
  const [description, setDescription] = useState(initial.description ?? "");
  const [responsable, setResponsable] = useState(initial.responsable_user_id ?? "");
  const [color, setColor] = useState(initial.color);
  const [icon, setIcon] = useState<CommissionIconName>(initial.icon as CommissionIconName);
  const [active, setActive] = useState(initial.active);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!nom.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/commissions/${commissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: nom.trim(),
        description: description.trim() || null,
        responsable_user_id: responsable || null,
        color,
        icon,
        active,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setEditOpen(false);
      router.refresh();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Erreur");
    }
  }

  async function remove() {
    if (!confirm(
      `Supprimer définitivement la commission « ${initial.nom} » ?\n\n` +
      `Toutes ses séances, membres, rattachements projets et émargements seront supprimés. ` +
      `Cette action est irréversible.`,
    )) return;
    setDeleting(true);
    const res = await fetch(`/api/commissions/${commissionId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      router.push("/admin/commissions");
      router.refresh();
    } else {
      const data = (await res.json()) as { error?: string };
      alert(data.error ?? "Suppression échouée");
    }
  }

  return (
    <>
      {canEdit && (
        <button type="button" onClick={() => setEditOpen(true)} className="civiq-btn civiq-btn-outline">
          <Pencil size={14} /> Modifier
        </button>
      )}
      {canDelete && (
        <button type="button" onClick={remove} disabled={deleting} className="civiq-btn civiq-btn-outline" style={{ color: "var(--civiq-warning)" }}>
          {deleting ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />} Supprimer
        </button>
      )}

      {editOpen && (
        <div className="pj-modal-backdrop" onClick={() => !saving && setEditOpen(false)}>
          <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pj-modal-title">Modifier la commission</h3>
            <div className="pj-modal-body">
              <label className="civiq-field-label">Nom</label>
              <input className="pj-input" value={nom} onChange={(e) => setNom(e.target.value)} />

              <label className="civiq-field-label">Description</label>
              <textarea rows={2} className="pj-input" value={description} onChange={(e) => setDescription(e.target.value)} />

              <label className="civiq-field-label">Responsable / président</label>
              <select className="pj-input" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                <option value="">— Aucun —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
                ))}
              </select>

              <div className="pj-comm-preview" style={{ ['--comm-color' as string]: color }}>
                <span className="pj-comm-chip">
                  <CommissionIcon name={icon} size={14} color="#fff" />
                  <span>{nom || "Nom de la commission"}</span>
                </span>
              </div>

              <label className="civiq-field-label">Couleur</label>
              <div className="pj-color-picker">
                {COMMISSION_COLOR_PALETTE.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className={`pj-color-swatch ${color === c ? "is-selected" : ""}`}
                    style={{ background: c }}
                    aria-label={`Couleur ${c}`}
                  />
                ))}
              </div>

              <label className="civiq-field-label">Icône</label>
              <div className="pj-icon-picker">
                {COMMISSION_ICONS.map((name) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => setIcon(name)}
                    className={`pj-icon-swatch ${icon === name ? "is-selected" : ""}`}
                    style={icon === name ? { background: color, color: "#fff", borderColor: color } : undefined}
                    aria-label={name}
                  >
                    <CommissionIcon name={name} size={16} />
                  </button>
                ))}
              </div>

              <label className="pj-checkbox" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <span>Commission active (visible dans le calendrier et le menu)</span>
              </label>

              {error && <div className="pj-modal-error">{error}</div>}
            </div>
            <div className="pj-modal-footer">
              <button type="button" onClick={() => setEditOpen(false)} disabled={saving} className="civiq-btn civiq-btn-ghost">
                Annuler
              </button>
              <button type="button" onClick={save} disabled={saving || !nom.trim()} className="civiq-btn civiq-btn-default">
                {saving ? <Loader2 className="spin" size={14} /> : null}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
