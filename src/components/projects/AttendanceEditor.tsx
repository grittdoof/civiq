"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, PenTool, UserPlus } from "lucide-react";
import SignaturePad from "./SignaturePad";
import { STATUT_EMARGEMENT, repartition, type Emargement, type StatutEmargement } from "@/lib/projects/emargement";

interface Props {
  commissionId: string;
  sessionId: string;
  /** Tous les membres de la séance (listeEmargement), convoqués ou non. */
  entries: Emargement[];
  currentUserId: string;
  /** Admin, éditeur, super-admin ou secrétaire de séance. */
  canManage: boolean;
  /** Compte rendu validé : pointage et signatures figés. */
  signaturesLocked: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Feuille d'émargement : TOUS les membres figurent (présent, excusé,
// absent, ou non renseigné), qu'une convocation soit partie ou non.
//
// Pointage : gestionnaires de la séance pour tous ; chaque élu pour
// lui-même. Signature électronique horodatée : l'élu signe pour lui ;
// celle d'un membre externe est recueillie en séance par un gestionnaire.
// ═══════════════════════════════════════════════════════════════

const STATUTS: StatutEmargement[] = ["present", "excuse", "absent"];
const BADGE: Record<StatutEmargement, string> = {
  present: "civiq-badge-success",
  excuse: "civiq-badge-warning",
  absent: "civiq-badge-error",
};

export default function AttendanceEditor({ commissionId, sessionId, entries, currentUserId, canManage, signaturesLocked }: Props) {
  const router = useRouter();
  const [signingFor, setSigningFor] = useState<Emargement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const url = `/api/commissions/${commissionId}/sessions/${sessionId}/attendance`;
  const r = repartition(entries);

  const cible = (e: Emargement) => (e.user_id ? { user_id: e.user_id } : { commission_member_id: e.member_id });

  async function post(e: Emargement, body: Record<string, unknown>): Promise<boolean> {
    setSaveError(null);
    setBusy(e.cle);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cible(e), ...body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(data.error ?? `Enregistrement impossible (erreur ${res.status})`);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setSaveError("Connexion perdue — réessayez.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const moi = entries.find((e) => e.user_id === currentUserId && !e.ancien) ?? null;
  const canIsign = !!moi && !moi.signature_data && !signaturesLocked;

  return (
    <>
      {saveError && <div className="pj-modal-error" role="alert">{saveError}</div>}

      {moi && (
        <div className="pj-sign-banner">
          {canIsign ? (
            <>
              <div>
                <strong>Bienvenue {moi.nom}.</strong>
                <p className="pj-table-sub" style={{ marginTop: 2 }}>
                  Vous êtes membre de cette commission : signez électroniquement la feuille d&apos;émargement.
                </p>
              </div>
              <button type="button" onClick={() => setSigningFor(moi)} className="civiq-btn civiq-btn-default">
                <PenTool size={14} aria-hidden="true" /> Signer maintenant
              </button>
            </>
          ) : moi.signature_data ? (
            <div className="pj-sign-banner-done">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>
                <strong>Merci, votre signature est enregistrée.</strong>
                {moi.signe_le && <span className="pj-table-sub" style={{ marginLeft: 6 }}>le {new Date(moi.signe_le).toLocaleString("fr-FR")}</span>}
              </span>
            </div>
          ) : (
            <div className="pj-sign-banner-locked">
              <Lock size={16} aria-hidden="true" />
              <span><strong>Émargement verrouillé.</strong> Le compte rendu a été validé.</span>
            </div>
          )}
        </div>
      )}

      <p className="pj-emargement-resume" role="status">
        {entries.length} membre{entries.length > 1 ? "s" : ""} : {r.presents.length} présent{r.presents.length > 1 ? "s" : ""},{" "}
        {r.excuses.length} excusé{r.excuses.length > 1 ? "s" : ""}, {r.absents.length} absent{r.absents.length > 1 ? "s" : ""}
        {r.nonRenseignes.length > 0 ? `, ${r.nonRenseignes.length} non renseigné${r.nonRenseignes.length > 1 ? "s" : ""}` : ""}.
      </p>

      {entries.length === 0 ? (
        <p className="pj-section-empty">
          Cette commission n&apos;a aucun membre : ajoutez-les sur la page de la commission, ils apparaîtront ici.
        </p>
      ) : (
        <div className="pj-stats-table-wrap">
          <table className="pj-table">
            <thead>
              <tr>
                <th scope="col">Membre</th>
                <th scope="col">Présence</th>
                <th scope="col">Signature</th>
                <th scope="col"><span className="pj-sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isMe = e.user_id === currentUserId;
                const peutPointer = !signaturesLocked && (canManage || isMe);
                const canSign = !signaturesLocked && !e.signature_data && (isMe || (e.externe && canManage));
                return (
                  <tr key={e.cle}>
                    <td>
                      <div className="pj-table-strong" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {e.externe && <UserPlus size={12} aria-label="Membre externe" />}
                        {e.nom}
                      </div>
                      {e.role === "president" && <div className="pj-table-sub">Président·e</div>}
                      {e.role === "vice_president" && <div className="pj-table-sub">Vice-président·e</div>}
                      {e.externe && <div className="pj-table-sub">Externe</div>}
                      {e.ancien && <div className="pj-table-sub">Ne fait plus partie de la commission</div>}
                    </td>
                    <td>
                      {peutPointer ? (
                        <div className="pj-emargement-statuts" role="radiogroup" aria-label={`Présence de ${e.nom}`}>
                          {STATUTS.map((st) => (
                            <button
                              key={st}
                              type="button"
                              role="radio"
                              aria-checked={e.statut === st}
                              disabled={busy === e.cle}
                              onClick={() => post(e, { statut: e.statut === st ? null : st })}
                              className={`civiq-badge ${e.statut === st ? BADGE[st] : "civiq-badge-muted"}`}
                              style={{ cursor: "pointer", border: 0 }}
                            >
                              {STATUT_EMARGEMENT[st]}
                            </button>
                          ))}
                        </div>
                      ) : e.statut ? (
                        <span className={`civiq-badge ${BADGE[e.statut]}`}>{STATUT_EMARGEMENT[e.statut]}</span>
                      ) : (
                        <span className="civiq-badge civiq-badge-muted">Non renseigné</span>
                      )}
                    </td>
                    <td>
                      {e.signature_data ? (
                        <div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={e.signature_data} alt={`Signature de ${e.nom}`} style={{ maxHeight: 36, maxWidth: 140 }} />
                          {e.signe_le && <div className="pj-table-sub">le {new Date(e.signe_le).toLocaleString("fr-FR")}</div>}
                        </div>
                      ) : (
                        <span className="pj-table-sub">—</span>
                      )}
                    </td>
                    <td>
                      {canSign && (
                        <button type="button" onClick={() => setSigningFor(e)} className="civiq-btn civiq-btn-outline civiq-btn-sm">
                          <PenTool size={12} aria-hidden="true" /> Signer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {signingFor && (
        <div className="pj-modal-backdrop" onClick={() => setSigningFor(null)}>
          <div className="pj-modal" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Émargement — ${signingFor.nom}`}>
            <h3 className="pj-modal-title">Émargement — {signingFor.nom}</h3>
            <div className="pj-modal-body">
              <p className="pj-section-empty">
                {signingFor.externe
                  ? "Le membre externe trace sa signature au doigt sur l'écran (vous la recueillez en séance)."
                  : "Tracez votre signature avec le doigt ou la souris. Elle sera horodatée et conservée."}
              </p>
              <SignaturePad
                onSign={async (data) => { if (await post(signingFor, { statut: "present", signature_data: data })) setSigningFor(null); }}
                onCancel={() => setSigningFor(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
