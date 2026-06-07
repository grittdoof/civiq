"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, X, PenTool } from "lucide-react";
import SignaturePad from "./SignaturePad";
import type { CommissionMemberRole } from "@/lib/projects/types";

interface Member { user_id: string; full_name: string | null; role: CommissionMemberRole; }
interface Attendance {
  user_id: string;
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
  /** Si la séance est passée, masque le bouton signature */
  sessionPast: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Feuille d'émargement avec signature électronique horodatée.
// Chaque conseiller signe pour lui-même (présence + signature
// PNG base64). Un admin peut marquer présent/absent en cliquant
// les pills (utile pour les absents avant édition du CR).
// ═══════════════════════════════════════════════════════════════

export default function AttendanceEditor({
  commissionId,
  sessionId,
  members,
  attendance,
  currentUserId,
  isAdmin,
  sessionPast,
}: Props) {
  const router = useRouter();
  const [signingFor, setSigningFor] = useState<string | null>(null);
  const map = new Map(attendance.map((a) => [a.user_id, a]));

  const url = `/api/commissions/${commissionId}/sessions/${sessionId}/attendance`;

  async function setPresence(userId: string, present: boolean) {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, present }),
    });
    router.refresh();
  }

  async function sign(userId: string, signatureDataUrl: string) {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        present: true,
        signature_data: signatureDataUrl,
      }),
    });
    setSigningFor(null);
    router.refresh();
  }

  return (
    <>
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
            const a = map.get(m.user_id);
            const isMe = m.user_id === currentUserId;
            const canSign = isMe && !a?.signature_data && !sessionPast;
            return (
              <tr key={m.user_id}>
                <td>
                  <div className="pj-table-strong">{m.full_name ?? "—"}</div>
                  {m.role === "president" && <div className="pj-table-sub">Président</div>}
                </td>
                <td>
                  {isAdmin ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setPresence(m.user_id, true)}
                        className={`civiq-badge ${a?.present === true ? "civiq-badge-success" : "civiq-badge-muted"}`}
                        style={{ cursor: "pointer" }}
                      >
                        <CheckCircle2 size={10} /> Présent
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresence(m.user_id, false)}
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
                  {canSign && (
                    <button
                      type="button"
                      onClick={() => setSigningFor(m.user_id)}
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
            <h3 className="pj-modal-title">Émargement — signature électronique</h3>
            <div className="pj-modal-body">
              <p className="pj-section-empty">
                Tracez votre signature avec le doigt ou la souris dans le cadre
                ci-dessous. La signature sera horodatée et conservée avec votre
                identifiant pour valeur de feuille d&apos;émargement.
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
