"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { computeEcart, formatEuros, formatPercent } from "@/lib/projects/cost-calc";

interface Props {
  projectId: string;
  budget_estime: number;
  cout_reel: number | null;
  explication_ecart: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Bloc bilan : coût réel + explication de l'écart.
// Le passage en bilan_cloture est bloqué tant que ces champs
// ne sont pas renseignés (vérifié côté serveur).
// ═══════════════════════════════════════════════════════════════

export default function BilanEditor({
  projectId,
  budget_estime,
  cout_reel,
  explication_ecart,
}: Props) {
  const router = useRouter();
  const [coutReel, setCoutReel] = useState(cout_reel !== null ? String(cout_reel) : "");
  const [explication, setExplication] = useState(explication_ecart ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const ecart = computeEcart(budget_estime, coutReel ? Number(coutReel) : null);

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cout_reel: coutReel ? Number(coutReel) : null,
        explication_ecart: explication.trim() || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <>
      <div className="pj-cost-grid">
        <div className="pj-cost-cell">
          <label className="civiq-field-label">Coût d&apos;investissement prévu</label>
          <div className="pj-cost-value">{formatEuros(budget_estime)}</div>
        </div>
        <div className="pj-cost-cell">
          <label className="civiq-field-label" htmlFor="cout_reel">Coût réel</label>
          <input
            id="cout_reel"
            type="number"
            className="pj-input"
            value={coutReel}
            onChange={(e) => setCoutReel(e.target.value)}
            placeholder="0"
          />
        </div>
        {ecart && (
          <div
            className={`pj-cost-cell ${
              ecart.value > 0 ? "pj-cost-cell-warn" : "pj-cost-cell-success"
            }`}
          >
            <div className="pj-cost-label">Écart</div>
            <div className="pj-cost-value">
              {ecart.value > 0 ? "+" : ""}{formatEuros(ecart.value)}
              <div className="pj-cost-rates">{formatPercent(ecart.pct)}</div>
            </div>
          </div>
        )}
      </div>

      <label className="civiq-field-label" htmlFor="expl">
        Explication de l&apos;écart {coutReel && <span style={{ color: "var(--civiq-warning)" }}>*</span>}
      </label>
      <textarea
        id="expl"
        rows={3}
        className="pj-input"
        value={explication}
        onChange={(e) => setExplication(e.target.value)}
        placeholder="Origine du dépassement ou de l'économie : avenant, surcoût technique, économie sur lot…"
      />

      <div className="pj-save-bar">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="civiq-btn civiq-btn-default civiq-btn-sm"
        >
          <Save size={14} /> {saving ? "Sauvegarde…" : "Enregistrer le bilan"}
        </button>
        {saved && <span className="pj-save-meta">✓ Enregistré</span>}
      </div>

      {!coutReel || !explication.trim() ? (
        <p className="pj-section-empty pj-bilan-warning">
          ⚠ <strong>Bilan obligatoire avant clôture.</strong> Le passage en étape
          « Bilan &amp; clôture » sera refusé tant que le coût réel et l&apos;explication
          de l&apos;écart ne seront pas renseignés.
        </p>
      ) : null}
    </>
  );
}
