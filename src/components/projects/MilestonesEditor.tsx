"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  type Milestone,
  type ProjectPhase,
} from "@/lib/projects/types";

interface Props {
  projectId: string;
  initial: Milestone[];
  currentPhase: ProjectPhase;
}

export default function MilestonesEditor({ projectId, initial, currentPhase }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({
    libelle: "",
    phase: currentPhase,
    echeance: "",
  });

  async function addRow() {
    if (!newRow.libelle.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        libelle: newRow.libelle.trim(),
        phase: newRow.phase,
        echeance: newRow.echeance || null,
      }),
    });
    if (res.ok) {
      const { milestone } = (await res.json()) as { milestone: Milestone };
      setRows([...rows, milestone]);
      setAdding(false);
      setNewRow({ libelle: "", phase: currentPhase, echeance: "" });
      router.refresh();
    }
  }

  async function toggleFait(mid: string, fait: boolean) {
    const res = await fetch(`/api/projects/${projectId}/milestones/${mid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fait }),
    });
    if (res.ok) {
      setRows(rows.map((r) => (r.id === mid ? { ...r, fait } : r)));
    }
  }

  async function deleteRow(mid: string) {
    if (!confirm("Supprimer cette étape clé ?")) return;
    const res = await fetch(`/api/projects/${projectId}/milestones/${mid}`, { method: "DELETE" });
    if (res.ok) {
      setRows(rows.filter((r) => r.id !== mid));
      router.refresh();
    }
  }

  return (
    <>
      {rows.length === 0 ? (
        <p className="pj-section-empty">Aucune étape clé définie.</p>
      ) : (
        <ul className="pj-milestones">
          {rows.map((m) => {
            const late = !m.fait && m.echeance && new Date(m.echeance) < new Date();
            return (
              <li key={m.id} className={`pj-milestone ${m.fait ? "is-done" : ""} ${late ? "is-late" : ""}`}>
                <input
                  type="checkbox"
                  checked={m.fait}
                  onChange={(e) => toggleFait(m.id, e.target.checked)}
                />
                <div className="pj-milestone-body">
                  <div className="pj-milestone-label">{m.libelle}</div>
                  <div className="pj-milestone-meta">
                    {PROJECT_PHASE_LABELS[m.phase]}
                    {m.echeance && <> — échéance {new Date(m.echeance).toLocaleDateString("fr-FR")}</>}
                    {late && <> — <strong>en retard</strong></>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteRow(m.id)}
                  className="civiq-icon-btn danger"
                  aria-label="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <div className="pj-add-row">
          <input
            placeholder="Libellé de l'étape clé (ex : Dépôt permis de construire)"
            className="pj-input"
            value={newRow.libelle}
            onChange={(e) => setNewRow({ ...newRow, libelle: e.target.value })}
          />
          <select
            value={newRow.phase}
            className="pj-input"
            onChange={(e) => setNewRow({ ...newRow, phase: e.target.value as ProjectPhase })}
          >
            {PROJECT_PHASES.map((p) => (
              <option key={p} value={p}>{PROJECT_PHASE_LABELS[p]}</option>
            ))}
          </select>
          <input
            type="date"
            className="pj-input"
            value={newRow.echeance}
            onChange={(e) => setNewRow({ ...newRow, echeance: e.target.value })}
          />
          <button
            type="button"
            onClick={addRow}
            disabled={!newRow.libelle.trim()}
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
          <Plus size={14} /> Ajouter une étape clé
        </button>
      )}
    </>
  );
}
