"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { PROJECT_PHASE_LABELS, type ProjectPhase } from "@/lib/projects/types";

interface ProjectRef { id: string; titre: string; phase: ProjectPhase; }
interface Row { id: string; project_id: string; project: ProjectRef | null; }

interface Props {
  commissionId: string;
  initial: Row[];
  directory: ProjectRef[];
  canEdit: boolean;
}

export default function CommissionProjectsEditor({ commissionId, initial, directory, canEdit }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [pickId, setPickId] = useState("");

  async function add() {
    if (!pickId) return;
    const res = await fetch(`/api/commissions/${commissionId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: pickId }),
    });
    if (res.ok) {
      const proj = directory.find((d) => d.id === pickId) ?? null;
      setRows([...rows, { id: crypto.randomUUID(), project_id: pickId, project: proj }]);
      setPicking(false);
      setPickId("");
      router.refresh();
    }
  }

  async function remove(pid: string) {
    const res = await fetch(`/api/commissions/${commissionId}/projects/${pid}`, { method: "DELETE" });
    if (res.ok) {
      setRows(rows.filter((r) => r.project_id !== pid));
      router.refresh();
    }
  }

  const taken = new Set(rows.map((r) => r.project_id));
  const available = directory.filter((d) => !taken.has(d.id));

  return (
    <>
      {rows.length === 0 ? (
        <p className="pj-section-empty">Aucun projet rattaché.</p>
      ) : (
        <ul className="pj-subs">
          {rows.map((r) => (
            <li key={r.id} className="pj-sub-row">
              <span>
                {r.project ? (
                  <Link href={`/admin/projects/${r.project.id}`} className="pj-table-strong">
                    {r.project.titre}
                  </Link>
                ) : "—"}
                {r.project && (
                  <span className="pj-table-sub" style={{ marginLeft: 6 }}>
                    {PROJECT_PHASE_LABELS[r.project.phase]}
                  </span>
                )}
              </span>
              {canEdit && (
                <button type="button" onClick={() => remove(r.project_id)} className="civiq-icon-btn" aria-label="Retirer">
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        picking ? (
          <div className="pj-add-row">
            <select value={pickId} className="pj-input" onChange={(e) => setPickId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>{d.titre}</option>
              ))}
            </select>
            <button type="button" onClick={add} disabled={!pickId} className="civiq-btn civiq-btn-default civiq-btn-sm">
              Rattacher
            </button>
            <button type="button" onClick={() => setPicking(false)} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
              Annuler
            </button>
          </div>
        ) : (
          available.length > 0 && (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="civiq-btn civiq-btn-outline civiq-btn-sm pj-add-btn"
            >
              <Plus size={14} /> Rattacher un projet
            </button>
          )
        )
      )}
    </>
  );
}
