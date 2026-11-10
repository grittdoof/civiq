"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Rattache les anciens tickets sans service au service par défaut de
// leur catégorie (réglé ci-dessus).
export default function RattacherServices({ possibles, sansService }: { possibles: number; sansService: number }) {
  const router = useRouter();
  const [etat, setEtat] = useState<"repos" | "envoi" | "ok">("repos");
  const [resultat, setResultat] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  async function rattacher() {
    setErr(null); setEtat("envoi");
    const r = await fetch("/api/tickets/services/rattacher", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "Rattachement impossible"); setEtat("repos"); return; }
    setResultat(j.rattaches ?? 0); setEtat("ok"); router.refresh();
  }

  if (etat === "ok") {
    return <p role="status" style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--success)", fontWeight: 600 }}>{resultat} ticket{resultat > 1 ? "s" : ""} rattaché{resultat > 1 ? "s" : ""} à leur service.</p>;
  }
  return (
    <div className="civiq-card" style={{ padding: 14, marginBottom: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, flex: "1 1 320px" }}>
        <strong>{sansService} ticket{sansService > 1 ? "s" : ""} sans service.</strong>{" "}
        {possibles > 0
          ? <>{possibles} peuvent être rattachés au service par défaut de leur catégorie.</>
          : <>Choisissez un service par défaut sur leurs catégories pour pouvoir les rattacher.</>}
      </p>
      {possibles > 0 && (
        <button type="button" className="civiq-btn civiq-btn-default" onClick={rattacher} disabled={etat === "envoi"} style={{ fontSize: 13 }}>
          {etat === "envoi" && <Loader2 size={14} className="civiq-spin" />} Rattacher {possibles} ticket{possibles > 1 ? "s" : ""}
        </button>
      )}
      {err && <span role="alert" style={{ fontSize: 13, color: "var(--destructive)", width: "100%" }}>{err}</span>}
    </div>
  );
}
