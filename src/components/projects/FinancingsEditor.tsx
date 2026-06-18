"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { formatEuros } from "@/lib/projects/cost-calc";
import { FINANCING_STATUS_LABELS, type Financing, type FinancingStatus } from "@/lib/projects/types";

interface Props {
  projectId: string;
  initial: Financing[];
  /** Si le projet a sans_subvention=true (affiche un badge informatif) */
  sansSubvention: boolean;
}

const FINANCING_STATUSES: FinancingStatus[] = [
  "a_demander", "demandee", "ar_recu", "accordee", "refusee", "soldee",
];

const SUGGESTED_FINANCEURS = [
  "État / DETR",
  "État / DSIL",
  "Département",
  "Région",
  "Europe (FEDER, FEADER)",
  "Autre",
];

export default function FinancingsEditor({ projectId, initial, sansSubvention }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({
    financeur: "",
    montant_demande: "",
    statut: "a_demander" as FinancingStatus,
  });
  const [saving, setSaving] = useState<string | null>(null);

  async function addRow() {
    if (!newRow.financeur.trim()) return;
    setSaving("new");
    const body = {
      financeur: newRow.financeur.trim(),
      montant_demande: newRow.montant_demande ? Number(newRow.montant_demande) : null,
      statut: newRow.statut,
    };
    const res = await fetch(`/api/projects/${projectId}/financings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(null);
    if (res.ok) {
      const { financing } = (await res.json()) as { financing: Financing };
      setRows([...rows, financing]);
      setAdding(false);
      setNewRow({ financeur: "", montant_demande: "", statut: "a_demander" });
      router.refresh();
    }
  }

  async function patchRow(fid: string, patch: Partial<Financing>) {
    setSaving(fid);
    const res = await fetch(`/api/projects/${projectId}/financings/${fid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(null);
    if (res.ok) {
      const { financing } = (await res.json()) as { financing: Financing };
      setRows(rows.map((r) => (r.id === fid ? financing : r)));
      router.refresh();
    }
  }

  async function deleteRow(fid: string) {
    if (!confirm("Supprimer cette ligne de financement ?")) return;
    setSaving(fid);
    const res = await fetch(`/api/projects/${projectId}/financings/${fid}`, { method: "DELETE" });
    setSaving(null);
    if (res.ok) {
      setRows(rows.filter((r) => r.id !== fid));
      router.refresh();
    }
  }

  const totalDemande = rows.reduce((s, r) => s + Number(r.montant_demande ?? 0), 0);
  const totalObtenu = rows.reduce((s, r) => s + Number(r.montant_obtenu ?? 0), 0);

  return (
    <>
      <table className="pj-table">
        <thead>
          <tr>
            <th>Financeur</th>
            <th>Demandé</th>
            <th>Obtenu</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id}>
              <td className="pj-table-strong">{f.financeur}</td>
              <td>
                <input
                  type="number"
                  defaultValue={f.montant_demande ?? ""}
                  className="pj-input pj-input-inline"
                  onBlur={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    if (v !== f.montant_demande) patchRow(f.id, { montant_demande: v });
                  }}
                />
              </td>
              <td>
                <input
                  type="number"
                  defaultValue={f.montant_obtenu ?? ""}
                  className="pj-input pj-input-inline"
                  onBlur={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    if (v !== f.montant_obtenu) patchRow(f.id, { montant_obtenu: v });
                  }}
                />
              </td>
              <td>
                <select
                  value={f.statut}
                  className="pj-input pj-input-inline"
                  onChange={(e) => patchRow(f.id, { statut: e.target.value as FinancingStatus })}
                >
                  {FINANCING_STATUSES.map((s) => (
                    <option key={s} value={s}>{FINANCING_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => deleteRow(f.id)}
                  className="civiq-icon-btn danger"
                  disabled={saving === f.id}
                  aria-label="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pj-table-strong">Total</td>
            <td className="pj-table-strong">{formatEuros(totalDemande)}</td>
            <td className="pj-table-strong">{formatEuros(totalObtenu)}</td>
            <td>
              {sansSubvention && (
                <span className="civiq-badge civiq-badge-muted">Autofinancement</span>
              )}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {adding ? (
        <div className="pj-add-row">
          <input
            list="financeurs-suggestions"
            placeholder="Financeur"
            className="pj-input"
            value={newRow.financeur}
            onChange={(e) => setNewRow({ ...newRow, financeur: e.target.value })}
          />
          <datalist id="financeurs-suggestions">
            {SUGGESTED_FINANCEURS.map((s) => <option key={s} value={s} />)}
          </datalist>
          <input
            type="number"
            placeholder="Montant demandé"
            className="pj-input"
            value={newRow.montant_demande}
            onChange={(e) => setNewRow({ ...newRow, montant_demande: e.target.value })}
          />
          <select
            value={newRow.statut}
            className="pj-input"
            onChange={(e) => setNewRow({ ...newRow, statut: e.target.value as FinancingStatus })}
          >
            {FINANCING_STATUSES.map((s) => (
              <option key={s} value={s}>{FINANCING_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={addRow}
            disabled={!newRow.financeur || saving === "new"}
            className="civiq-btn civiq-btn-default civiq-btn-sm"
          >
            Ajouter
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="civiq-btn civiq-btn-ghost civiq-btn-sm"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="civiq-btn civiq-btn-outline civiq-btn-sm pj-add-btn"
        >
          <Plus size={14} /> Ajouter un financement
        </button>
      )}
    </>
  );
}
