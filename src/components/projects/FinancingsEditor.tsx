"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Shield,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { formatEuros } from "@/lib/projects/cost-calc";
import {
  FINANCING_STATUS_LABELS,
  FINANCING_ELIGIBILITY_LABELS,
  type Financing,
  type FinancingStatus,
  type FinancingEligibility,
} from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// FinancingsEditor — table éditable des financements + suivi
// détaillé d'éligibilité par dispositif (DETR/DSIL, FCTVA,
// Fondation du Patrimoine, etc.)
//
// UX :
//   - vue compacte par défaut : une ligne par financement avec
//     badge éligibilité (vert/orange/rouge/gris) calculé en live
//   - chaque ligne peut s'EXPANDRE pour révéler les champs détaillés
//     (progressive disclosure) : dispositif, dates, taux/plafond,
//     définition du commencement, note de régularisation
//   - alerte visible si la notif des marchés a précédé l'AR
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  initial: Financing[];
  sansSubvention: boolean;
}

const FINANCING_STATUSES: FinancingStatus[] = [
  "a_demander", "demandee", "ar_recu", "accordee", "refusee", "soldee",
];

const ELIGIBILITIES: FinancingEligibility[] = [
  "a_evaluer", "preservee", "vigilance", "compromise",
];

// Financeurs courants suggérés (datalist). Inspiré des dispositifs
// classiques du bloc communal + ceux cités par le maire.
const SUGGESTED_FINANCEURS = [
  "État — DETR",
  "État — DSIL",
  "État — FCTVA",
  "Département",
  "Région",
  "Banque des territoires",
  "Fondation du Patrimoine",
  "Mécénat privé",
  "Europe (FEDER, FEADER)",
  "Autre",
];

// Calcule l'éligibilité côté client (mirroir simple du SQL).
function computeEligibility(f: Financing): FinancingEligibility {
  const dDem = f.date_demande;
  const dAr = f.date_ar;
  const dMarche = f.date_notification_marche;
  const dOs = f.date_ordre_service;
  const dStart = [dMarche, dOs].filter(Boolean).sort()[0] || null;

  if (!dDem && !dAr) {
    if (dStart) return "compromise"; // marché notifié sans demande
    return "a_evaluer";
  }
  if (!dAr) {
    if (dStart && dStart < (dDem || "9999-12-31")) return "compromise";
    if (dStart) return "vigilance";
    return "preservee";
  }
  // AR reçu : commencement doit être >= AR
  if (dStart && dStart < dAr) return "compromise";
  return "preservee";
}

// Badge éligibilité avec icône Lucide cohérente
function EligibilityBadge({ value }: { value: FinancingEligibility }) {
  const config: Record<FinancingEligibility, { icon: typeof Shield; cls: string }> = {
    a_evaluer:   { icon: Shield,        cls: "pj-elig pj-elig-muted" },
    preservee:   { icon: ShieldCheck,   cls: "pj-elig pj-elig-ok" },
    vigilance:   { icon: ShieldAlert,   cls: "pj-elig pj-elig-warn" },
    compromise:  { icon: ShieldX,       cls: "pj-elig pj-elig-danger" },
  };
  const { icon: Icon, cls } = config[value];
  return (
    <span className={cls} title={FINANCING_ELIGIBILITY_LABELS[value]}>
      <Icon size={12} />
      <span>{FINANCING_ELIGIBILITY_LABELS[value]}</span>
    </span>
  );
}

export default function FinancingsEditor({ projectId, initial, sansSubvention }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newRow, setNewRow] = useState({
    financeur: "",
    dispositif: "",
    montant_demande: "",
    statut: "a_demander" as FinancingStatus,
  });
  const [saving, setSaving] = useState<string | null>(null);

  function toggleExpand(fid: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fid)) next.delete(fid);
      else next.add(fid);
      return next;
    });
  }

  async function addRow() {
    if (!newRow.financeur.trim()) return;
    setSaving("new");
    const body = {
      financeur: newRow.financeur.trim(),
      dispositif: newRow.dispositif.trim() || null,
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
      setNewRow({ financeur: "", dispositif: "", montant_demande: "", statut: "a_demander" });
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
  const compromised = rows.filter((r) => computeEligibility(r) === "compromise").length;

  return (
    <div className="pj-financings-wrap">
      {compromised > 0 && (
        <div className="pj-financings-alert" role="alert">
          <AlertTriangle size={16} />
          <div>
            <strong>{compromised} dossier{compromised > 1 ? "s" : ""} en éligibilité compromise.</strong>
            <span> La notification des marchés a précédé l&apos;AR du dossier — vérifiez les possibilités de régularisation dans la zone détaillée.</span>
          </div>
        </div>
      )}

      <table className="pj-table pj-financings-table">
        <thead>
          <tr>
            <th></th>
            <th>Financeur / Dispositif</th>
            <th>Demandé</th>
            <th>Obtenu</th>
            <th>Statut</th>
            <th>Éligibilité</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const isOpen = expanded.has(f.id);
            const eligibility = f.eligibilite === "a_evaluer" ? computeEligibility(f) : f.eligibilite;
            return (
              <Fragment key={f.id}>
                <tr className={isOpen ? "pj-row-open" : undefined}>
                  <td className="pj-row-toggle-cell">
                    <button
                      type="button"
                      className={`pj-row-toggle${isOpen ? " is-open" : ""}`}
                      onClick={() => toggleExpand(f.id)}
                      aria-label={isOpen ? "Replier" : "Déplier"}
                      aria-expanded={isOpen}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </td>
                  <td className="pj-table-strong">
                    <div className="pj-financeur-stack">
                      <span>{f.financeur}</span>
                      {f.dispositif && (
                        <span className="pj-financeur-dispositif">{f.dispositif}</span>
                      )}
                    </div>
                  </td>
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
                    <EligibilityBadge value={eligibility} />
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

                {/* Ligne détaillée — progressive disclosure */}
                <tr className="pj-row-detail" aria-hidden={!isOpen}>
                  <td colSpan={7} style={{ padding: 0, border: 0 }}>
                    <div className="pj-row-detail-collapse" data-open={isOpen}>
                      <div className="pj-row-detail-inner">
                        <div className="pj-detail-grid">
                          <div className="pj-detail-field">
                            <label>Dispositif (intitulé précis)</label>
                            <input
                              type="text"
                              className="pj-input"
                              defaultValue={f.dispositif ?? ""}
                              placeholder="Ex : DETR — Patrimoine non protégé"
                              onBlur={(e) => {
                                const v = e.target.value.trim() || null;
                                if (v !== f.dispositif) patchRow(f.id, { dispositif: v });
                              }}
                            />
                          </div>
                          <div className="pj-detail-field">
                            <label>Taux (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              className="pj-input"
                              defaultValue={f.taux ?? ""}
                              placeholder="Ex : 30"
                              onBlur={(e) => {
                                const v = e.target.value ? Number(e.target.value) : null;
                                if (v !== f.taux) patchRow(f.id, { taux: v });
                              }}
                            />
                          </div>
                          <div className="pj-detail-field">
                            <label>Plafond (€)</label>
                            <input
                              type="number"
                              className="pj-input"
                              defaultValue={f.plafond ?? ""}
                              placeholder="Ex : 200000"
                              onBlur={(e) => {
                                const v = e.target.value ? Number(e.target.value) : null;
                                if (v !== f.plafond) patchRow(f.id, { plafond: v });
                              }}
                            />
                          </div>
                          <div className="pj-detail-field">
                            <label>
                              <Calendar size={12} aria-hidden /> Échéance de dépôt
                            </label>
                            <input
                              type="date"
                              className="pj-input"
                              defaultValue={f.deadline_depot ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value || null;
                                if (v !== f.deadline_depot) patchRow(f.id, { deadline_depot: v });
                              }}
                            />
                          </div>

                          <div className="pj-detail-section-label">Calendrier critique</div>

                          <div className="pj-detail-field">
                            <label>Date de dépôt</label>
                            <input
                              type="date"
                              className="pj-input"
                              defaultValue={f.date_demande ?? ""}
                              onBlur={(e) => patchRow(f.id, { date_demande: e.target.value || null })}
                            />
                          </div>
                          <div className="pj-detail-field">
                            <label>AR du dossier complet</label>
                            <input
                              type="date"
                              className="pj-input"
                              defaultValue={f.date_ar ?? ""}
                              onBlur={(e) => patchRow(f.id, { date_ar: e.target.value || null })}
                            />
                          </div>
                          <div className="pj-detail-field">
                            <label>Notification des marchés</label>
                            <input
                              type="date"
                              className="pj-input"
                              defaultValue={f.date_notification_marche ?? ""}
                              onBlur={(e) =>
                                patchRow(f.id, {
                                  date_notification_marche: e.target.value || null,
                                })
                              }
                            />
                          </div>
                          <div className="pj-detail-field">
                            <label>Ordre de service</label>
                            <input
                              type="date"
                              className="pj-input"
                              defaultValue={f.date_ordre_service ?? ""}
                              onBlur={(e) =>
                                patchRow(f.id, { date_ordre_service: e.target.value || null })
                              }
                            />
                          </div>

                          <div className="pj-detail-field pj-detail-field-wide">
                            <label>Définition du commencement d&apos;exécution (règlement du dispositif)</label>
                            <textarea
                              rows={2}
                              className="pj-input"
                              defaultValue={f.definition_commencement ?? ""}
                              placeholder="Ex : tout engagement juridique ou financier antérieur à la réception du dossier complet."
                              onBlur={(e) =>
                                patchRow(f.id, {
                                  definition_commencement: e.target.value.trim() || null,
                                })
                              }
                            />
                          </div>

                          <div className="pj-detail-field">
                            <label>Éligibilité (forçage manuel)</label>
                            <select
                              value={f.eligibilite}
                              className="pj-input"
                              onChange={(e) =>
                                patchRow(f.id, { eligibilite: e.target.value as FinancingEligibility })
                              }
                            >
                              {ELIGIBILITIES.map((e) => (
                                <option key={e} value={e}>
                                  {FINANCING_ELIGIBILITY_LABELS[e]}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="pj-detail-field pj-detail-field-wide">
                            <label>Possibilités de régularisation / note d&apos;éligibilité</label>
                            <textarea
                              rows={2}
                              className="pj-input"
                              defaultValue={f.eligibilite_note ?? ""}
                              placeholder="Ex : démarche de régularisation auprès de la préfecture en cours, demande d'avance d'aide…"
                              onBlur={(e) =>
                                patchRow(f.id, {
                                  eligibilite_note: e.target.value.trim() || null,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td></td>
            <td className="pj-table-strong">Total</td>
            <td className="pj-table-strong">{formatEuros(totalDemande)}</td>
            <td className="pj-table-strong">{formatEuros(totalObtenu)}</td>
            <td colSpan={2}>
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
            placeholder="Financeur (ex : État — DETR)"
            className="pj-input"
            value={newRow.financeur}
            onChange={(e) => setNewRow({ ...newRow, financeur: e.target.value })}
          />
          <datalist id="financeurs-suggestions">
            {SUGGESTED_FINANCEURS.map((s) => <option key={s} value={s} />)}
          </datalist>
          <input
            type="text"
            placeholder="Dispositif (facultatif)"
            className="pj-input"
            value={newRow.dispositif}
            onChange={(e) => setNewRow({ ...newRow, dispositif: e.target.value })}
          />
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
    </div>
  );
}
