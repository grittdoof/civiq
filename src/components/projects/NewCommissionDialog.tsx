"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { COMMISSION_COLOR_PALETTE, COMMISSION_ICONS, type CommissionIconName } from "@/lib/projects/types";
import CommissionIcon from "./CommissionIcon";

interface Profile { id: string; full_name: string | null; }
interface ParentChoice { id: string; nom: string; color: string; icon: string; }

interface Props {
  profiles: Profile[];
  /** Commissions racines existantes — utilisées comme parents possibles pour
   *  une sous-commission (on évite la création de petits-enfants en limitant
   *  à 1 niveau de hiérarchie). */
  possibleParents: ParentChoice[];
  /** Si défini, le dialog s'ouvre en mode 'sous-commission' avec parent
   *  pré-sélectionné. Utile depuis la fiche d'une commission existante. */
  presetParentId?: string;
  /** Label personnalisé pour le bouton */
  buttonLabel?: string;
}

export default function NewCommissionDialog({
  profiles, possibleParents, presetParentId, buttonLabel,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [responsable, setResponsable] = useState("");
  const [parentId, setParentId] = useState(presetParentId ?? "");
  const [color, setColor] = useState(COMMISSION_COLOR_PALETTE[0]);
  const [icon, setIcon] = useState<CommissionIconName>("Gavel");
  const [loading, setLoading] = useState(false);

  // Si on a un parent pré-sélectionné, on calque sa couleur/icône par défaut
  // pour suggérer la cohérence visuelle (l'utilisateur peut changer).
  function applyParentDefaults(id: string) {
    const p = possibleParents.find((x) => x.id === id);
    if (p) {
      setColor(p.color);
      setIcon(p.icon as CommissionIconName);
    }
  }

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
        parent_id: parentId || null,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      setNom(""); setDescription(""); setResponsable("");
      setParentId(presetParentId ?? "");
      setColor(COMMISSION_COLOR_PALETTE[0]);
      setIcon("Gavel");
      router.refresh();
    }
  }

  const isSubcommission = Boolean(parentId);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (presetParentId) applyParentDefaults(presetParentId);
          setOpen(true);
        }}
        className="civiq-btn civiq-btn-default"
      >
        <Plus size={14} /> {buttonLabel ?? "Nouvelle commission"}
      </button>
      {open && (
        <div className="pj-modal-backdrop" onClick={() => !loading && setOpen(false)}>
          <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pj-modal-title">
              {isSubcommission ? "Nouvelle sous-commission" : "Nouvelle commission municipale"}
            </h3>
            <div className="pj-modal-body">
              <label className="civiq-field-label">Nom</label>
              <input
                className="pj-input"
                placeholder={isSubcommission ? "ex : Voirie, Aménagement…" : "ex : Finances, Travaux/Voirie, Urbanisme…"}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
              />

              {/* Sélecteur parent — masqué si pré-sélectionné */}
              {!presetParentId && possibleParents.length > 0 && (
                <>
                  <label className="civiq-field-label">Commission parente (sous-commission)</label>
                  <select
                    className="pj-input"
                    value={parentId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setParentId(newId);
                      if (newId) applyParentDefaults(newId);
                    }}
                  >
                    <option value="">— Aucune (commission de premier niveau) —</option>
                    {possibleParents.map((p) => (
                      <option key={p.id} value={p.id}>{p.nom}</option>
                    ))}
                  </select>
                  <p className="pj-table-sub" style={{ marginTop: 2 }}>
                    Permet de structurer en sous-thèmes
                    (ex : « Urbanisme » → « Voirie », « Aménagement »).
                  </p>
                </>
              )}

              <label className="civiq-field-label">Description</label>
              <textarea
                rows={2}
                className="pj-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <label className="civiq-field-label">Responsable / président·e</label>
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
