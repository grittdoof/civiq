"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { COMMISSION_COLOR_PALETTE, COMMISSION_ICONS, type CommissionIconName } from "@/lib/projects/types";
import CommissionIcon from "./CommissionIcon";

interface Profile { id: string; full_name: string | null; }

export default function NewCommissionDialog({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [responsable, setResponsable] = useState("");
  const [color, setColor] = useState(COMMISSION_COLOR_PALETTE[0]);
  const [icon, setIcon] = useState<CommissionIconName>("Gavel");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!nom.trim()) return;
    setLoading(true);
    const res = await fetch("/api/commissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: nom.trim(),
        description: description.trim() || null,
        responsable_user_id: responsable || null,
        color,
        icon,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      setNom(""); setDescription(""); setResponsable("");
      setColor(COMMISSION_COLOR_PALETTE[0]);
      setIcon("Gavel");
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="civiq-btn civiq-btn-default"
      >
        <Plus size={14} /> Nouvelle commission
      </button>
      {open && (
        <div className="pj-modal-backdrop" onClick={() => !loading && setOpen(false)}>
          <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pj-modal-title">Nouvelle commission municipale</h3>
            <div className="pj-modal-body">
              <label className="civiq-field-label">Nom</label>
              <input
                className="pj-input"
                placeholder="ex : Finances, Travaux/Voirie, Urbanisme…"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
              />
              <label className="civiq-field-label">Description</label>
              <textarea
                rows={2}
                className="pj-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <label className="civiq-field-label">Responsable / président</label>
              <select
                className="pj-input"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
              >
                <option value="">— Aucun —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
                ))}
              </select>

              {/* Aperçu live */}
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
            </div>
            <div className="pj-modal-footer">
              <button type="button" onClick={() => setOpen(false)} className="civiq-btn civiq-btn-ghost" disabled={loading}>
                Annuler
              </button>
              <button type="button" onClick={submit} disabled={loading || !nom.trim()} className="civiq-btn civiq-btn-default">
                {loading ? <Loader2 className="spin" size={14} /> : null}
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
