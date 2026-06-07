"use client";

import type { CommissionMemberRole } from "@/lib/projects/types";

interface Member { user_id: string; full_name: string | null; role: CommissionMemberRole; }
interface Attendance {
  user_id: string;
  present: boolean | null;
  signature_data: string | null;
  signe_le: string | null;
}

interface Props {
  sessionId: string;
  members: Member[];
  attendance: Attendance[];
  currentUserId: string;
  isAdmin: boolean;
  sessionPast: boolean;
}

// Stub — implémenté au commit 15.
export default function AttendanceEditor({ members, attendance }: Props) {
  const byUser = new Map(attendance.map((a) => [a.user_id, a]));
  return (
    <ul className="pj-subs">
      {members.map((m) => {
        const a = byUser.get(m.user_id);
        return (
          <li key={m.user_id} className="pj-sub-row">
            <span>
              {m.full_name ?? m.user_id}
              {m.role === "president" && <span className="civiq-badge civiq-badge-default" style={{ marginLeft: 6 }}>Président</span>}
            </span>
            <span>
              {a?.present === true ? (
                <span className="civiq-badge civiq-badge-success">Présent</span>
              ) : a?.present === false ? (
                <span className="civiq-badge civiq-badge-muted">Absent</span>
              ) : (
                <span className="civiq-badge civiq-badge-muted">—</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
