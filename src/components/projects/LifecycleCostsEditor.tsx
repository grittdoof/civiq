"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { computeGlobalCost, formatEuros, type LifecycleCostRow } from "@/lib/projects/cost-calc";

interface Props {
  projectId: string;
  initial: { annee: number; cout_fonctionnement: number; cout_entretien: number }[];
  budget_estime: number;
  taux_inflation: number;
  taux_actualisation: number;
}

// ═══════════════════════════════════════════════════════════════
// Tableau éditable des coûts d'exploitation années 1→10.
// Calcule le coût global nominal + actualisé en direct.
// Sauvegarde par bulk PUT (une seule requête).
// ═══════════════════════════════════════════════════════════════

export default function LifecycleCostsEditor({
  projectId,
  initial,
  budget_estime,
  taux_inflation,
  taux_actualisation,
}: Props) {
  const router = useRouter();
  const initialMap = new Map(initial.map((r) => [r.annee, r]));
  const [rows, setRows] = useState<{ annee: number; fonct: string; entr: string }[]>(
    Array.from({ length: 10 }, (_, i) => {
      const a = i + 1;
      const r = initialMap.get(a);
      return {
        annee: a,
        fonct: r ? String(r.cout_fonctionnement) : "",
        entr: r ? String(r.cout_entretien) : "",
      };
    }),
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function setRow(annee: number, patch: Partial<{ fonct: string; entr: string }>) {
    setRows(rows.map((r) => (r.annee === annee ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    const payload: LifecycleCostRow[] = rows
      .map((r) => ({
        annee: r.annee,
        cout_fonctionnement: r.fonct ? Number(r.fonct) : 0,
        cout_entretien: r.entr ? Number(r.entr) : 0,
      }))
      .filter((r) => r.cout_fonctionnement !== 0 || r.cout_entretien !== 0);
    const res = await fetch(`/api/projects/${projectId}/lifecycle-costs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: payload }),
    });
    setSaving(false);
    if (res.ok) {
      setSavedAt(new Date().toLocaleTimeString("fr-FR"));
      router.refresh();
    }
  }

  // Recalcul live
  const livePayload: LifecycleCostRow[] = rows.map((r) => ({
    annee: r.annee,
    cout_fonctionnement: r.fonct ? Number(r.fonct) : 0,
    cout_entretien: r.entr ? Number(r.entr) : 0,
  }));
  const cost = computeGlobalCost({
    budget_estime,
    lifecycle: livePayload,
    rates: { taux_inflation, taux_actualisation },
  });

  return (
    <>
      <table className="pj-table pj-lifecycle-table">
        <thead>
          <tr>
            <th>Année</th>
            <th>Fonctionnement (€/an)</th>
            <th>Entretien (€/an)</th>
            <th>Total constant</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const fonct = Number(r.fonct || 0);
            const entr = Number(r.entr || 0);
            return (
              <tr key={r.annee}>
                <td>{r.annee}</td>
                <td>
                  <input
                    type="number"
                    value={r.fonct}
                    className="pj-input pj-input-inline"
                    placeholder="0"
                    onChange={(e) => setRow(r.annee, { fonct: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.entr}
                    className="pj-input pj-input-inline"
                    placeholder="0"
                    onChange={(e) => setRow(r.annee, { entr: e.target.value })}
                  />
                </td>
                <td className="pj-table-strong">
                  {fonct + entr > 0 ? formatEuros(fonct + entr) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="pj-cost-grid">
        <div className="pj-cost-cell">
          <div className="pj-cost-label">Investissement</div>
          <div className="pj-cost-value">{formatEuros(cost.invest)}</div>
        </div>
        <div className="pj-cost-cell">
          <div className="pj-cost-label">Coût global nominal</div>
          <div className="pj-cost-value">{formatEuros(cost.total_nominal)}</div>
        </div>
        <div className="pj-cost-cell pj-cost-cell-highlight">
          <div className="pj-cost-label">Coût global actualisé</div>
          <div className="pj-cost-value">{formatEuros(cost.total_actualise)}</div>
          <div className="pj-cost-rates">
            Inflation {taux_inflation.toFixed(1)} % · Actualisation {taux_actualisation.toFixed(1)} %
          </div>
        </div>
      </div>

      <div className="pj-save-bar">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="civiq-btn civiq-btn-default civiq-btn-sm"
        >
          <Save size={14} /> {saving ? "Sauvegarde…" : "Enregistrer les coûts"}
        </button>
        {savedAt && <span className="pj-save-meta">Sauvegardé à {savedAt}</span>}
      </div>
    </>
  );
}
