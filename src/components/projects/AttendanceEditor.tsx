"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, X, PenTool, UserPlus, Lock } from "lucide-react";
import SignaturePad from "./SignaturePad";
import type { CommissionMemberRole } from "@/lib/projects/types";

interface Member {
  /** id de commission_members */
  member_id: string;
  /** user_id si compte GoCiviq, null si externe */
  user_id: string | null;
  full_name: string;
  role: CommissionMemberRole;
  /** True pour les externes (sans compte) */
  isExternal: boolean;
}

interface Attendance {
  /** id de commission_members (pour les externes) */
  member_id: string | null;
  user_id: string | null;
  present: boolean | null;
  signature_data: string | null;
  signe_le: string | null;
}

interface Props {
  commissionId: string;
  sessionId: string;
  members: Member[];
  attendance: Attendance[];
  currentUserId: string;
  isAdmin: boolean;
  /** Émargement verrouillé : le compte rendu a été validé.
   *  Tant qu'il est en brouillon, les signatures restent ouvertes. */
  signaturesLocked: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Feuille d'émargement — signature électronique horodatée.
//
// Membres internes : signent pour eux-mêmes (canvas SignaturePad).
// Membres externes : seul un admin peut les marquer présents et
// recueillir leur signature à leur place (cas du tactile partagé
// en séance) ou la saisir.
// ═══════════════════════════════════════════════════════════════

export default function AttendanceEditor({
  commissionId,
  sessionId,
  members,
  attendance,
  currentUserId,
  isAdmin,
  signaturesLocked,
}: Props) {
  const router = useRouter();
  const [signingFor, setSigningFor] = useState<Member | null>(null);

  // Lookup d'attendance : par user_id pour internes, par member_id pour externes
  const byUser = new Map<string, Attendance>();
  const byMember = new Map<string, Attendance>();
  for (const a of attendance) {
    if (a.user_id) byUser.set(a.user_id, a);
    if (a.member_id) byMember.set(a.member_id, a);
  }

  function getAttendance(m: Member): Attendance | undefined {
    if (m.isExternal) return byMember.get(m.member_id);
    return m.user_id ? byUser.get(m.user_id) : undefined;
  }

  const url = `/api/commissions/${commissionId}/sessions/${sessionId}/attendance`;

  async function setPresence(m: Member, present: boolean) {
    const body: Record<string, unknown> = { present };
    if (m.isExternal) {
      body.commission_member_id = m.member_id;
    } else {
      body.user_id = m.user_id;
    }
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  async function sign(m: Member, signatureDataUrl: string) {
    const body: Record<string, unknown> = {
      present: true,
      signature_data: signatureDataUrl,
    };
    if (m.isExternal) {
      body.commission_member_id = m.member_id;
    } else {
      body.user_id = m.user_id;
    }
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSigningFor(null);
    router.refresh();
  }

  // ── Résolution du contexte « moi » pour l'aide explicite ──
  const myMember = members.find((m) => !m.isExternal && m.user_id === currentUserId) ?? null;
  const myAttendance = myMember ? byUser.get(myMember.user_id!) : undefined;
  const alreadySigned = !!myAttendance?.signature_data;
  const canIsign = !!myMember && !alreadySigned && !signaturesLocked;

  return (
    <>
      {/* ─── Bandeau « Signer maintenant » mis en avant ─── */}
      {myMember && (
        <div className="pj-sign-banner">
          {canIsign ? (
            <>
              <div>
                <strong>Bienvenue {myMember.full_name}.</strong>
                <p className="pj-table-sub" style={{ marginTop: 2 }}>
                  Vous êtes membre de cette commission. Cliquez ci-contre pour
                  signer électroniquement la feuille d&apos;émargement.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSigningFor(myMember)}
                className="civiq-btn civiq-btn-default"
              >
                <PenTool size={14} /> Signer maintenant
              </button>
            </>
          ) : alreadySigned ? (
            <div className="pj-sign-banner-done">
              <CheckCircle2 size={16} />
              <span>
                <strong>Merci, votre signature est enregistrée.</strong>
                {myAttendance?.signe_le && (
                  <span className="pj-table-sub" style={{ marginLeft: 6 }}>
                    le {new Date(myAttendance.signe_le).toLocaleString("fr-FR")}
                  </span>
                )}
              </span>
            </div>
          ) : signaturesLocked ? (
            <div className="pj-sign-banner-locked">
              <Lock size={16} />
              <span>
                <strong>Émargement verrouillé.</strong>{" "}
                Le compte rendu a été validé, les signatures ne peuvent plus
                être ajoutées.
              </span>
            </div>
          ) : null}
        </div>
      )}
      {!myMember && !isAdmin && (
        <div className="pj-sign-banner pj-sign-banner-info">
          <span>
            Vous n&apos;êtes pas membre de cette commission, vous ne pouvez
            donc pas signer. Les signatures sont réservées aux conseillers
            désignés.
          </span>
        </div>
      )}

      <table className="pj-table">
        <thead>
          <tr>
            <th>Conseiller</th>
            <th>Présence</th>
            <th>Signature</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const a = getAttendance(m);
            const isMe = !m.isExternal && m.user_id === currentUserId;
            const canSignSelf = isMe && !a?.signature_data && !signaturesLocked;
            // Pour les externes : seul l'admin peut signer à leur place
            const canSignExternal = m.isExternal && isAdmin && !a?.signature_data;
            return (
              <tr key={m.member_id}>
                <td>
                  <div className="pj-table-strong" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {m.isExternal && (
                      <span title="Membre externe (sans compte GoCiviq)" style={{ display: "inline-flex" }}>
                        <UserPlus size={12} />
                      </span>
                    )}
                    {m.full_name}
                  </div>
                  {m.role === "president" && <div className="pj-table-sub">Président·e</div>}
                  {m.role === "vice_president" && <div className="pj-table-sub">Vice-président·e</div>}
                  {m.isExternal && <div className="pj-table-sub">Externe</div>}
                </td>
                <td>
                  {isAdmin ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setPresence(m, true)}
                        className={`civiq-badge ${a?.present === true ? "civiq-badge-success" : "civiq-badge-muted"}`}
                        style={{ cursor: "pointer" }}
                      >
                        <CheckCircle2 size={10} /> Présent
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresence(m, false)}
                        className={`civiq-badge ${a?.present === false ? "civiq-badge-warning" : "civiq-badge-muted"}`}
                        style={{ cursor: "pointer" }}
                      >
                        <X size={10} /> Absent
                      </button>
                    </div>
                  ) : a?.present === true ? (
                    <span className="civiq-badge civiq-badge-success">Présent</span>
                  ) : a?.present === false ? (
                    <span className="civiq-badge civiq-badge-muted">Absent</span>
                  ) : (
                    <span className="civiq-badge civiq-badge-muted">—</span>
                  )}
                </td>
                <td>
                  {a?.signature_data ? (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.signature_data}
                        alt="Signature"
                        style={{ maxHeight: 36, maxWidth: 140 }}
                      />
                      {a.signe_le && (
                        <div className="pj-table-sub">
                          le {new Date(a.signe_le).toLocaleString("fr-FR")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="pj-table-sub">—</span>
                  )}
                </td>
                <td>
                  {(canSignSelf || canSignExternal) && (
                    <button
                      type="button"
                      onClick={() => setSigningFor(m)}
                      className="civiq-btn civiq-btn-outline civiq-btn-sm"
                    >
                      <PenTool size={12} /> Signer
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {signingFor && (
        <div className="pj-modal-backdrop" onClick={() => setSigningFor(null)}>
          <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pj-modal-title">
              Émargement — {signingFor.full_name}
            </h3>
            <div className="pj-modal-body">
              <p className="pj-section-empty">
                {signingFor.isExternal
                  ? "Le membre externe trace sa signature au doigt sur l'écran (vous, administrateur, la collectez en séance)."
                  : "Tracez votre signature avec le doigt ou la souris. Elle sera horodatée et conservée."}
              </p>
              <SignaturePad
                onSign={(data) => sign(signingFor, data)}
                onCancel={() => setSigningFor(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
