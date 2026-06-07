"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

interface Profile { id: string; full_name: string | null; }

export default function NewCommissionDialog({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [responsable, setResponsable] = useState("");
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
      }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      setNom(""); setDescription(""); setResponsable("");
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
                placeholder="ex: Finances, Travaux/Voirie, Urbanisme…"
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
