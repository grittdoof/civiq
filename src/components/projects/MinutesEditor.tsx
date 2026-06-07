"use client";

// Stub — implémenté au commit 16.
interface Props {
  commissionId: string;
  sessionId: string;
  initial: string;
  validated: boolean;
  canEdit: boolean;
}

export default function MinutesEditor({ initial, validated }: Props) {
  return (
    <div>
      {initial ? (
        <p className="pj-section-content">{initial}</p>
      ) : (
        <p className="pj-section-empty">Compte rendu non encore rédigé.</p>
      )}
      {validated && <p className="pj-table-sub">Verrouillé.</p>}
    </div>
  );
}
