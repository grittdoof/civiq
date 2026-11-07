"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { FONCTION_LABEL } from "@/lib/profils/fonctions";

// ═══════════════════════════════════════════════════════════════
// Services de la commune et leurs membres (lot 1).
// Un membre voit les tickets de son service si la matrice de la
// commune règle sa fonction sur « son service ». Pour un adjoint,
// ses services = sa délégation.
// ═══════════════════════════════════════════════════════════════

interface ServiceRow { id: string; nom: string; membres: string[] }
interface Personne { id: string; full_name: string | null; job_title: string | null }

async function appel(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Erreur");
  return j;
}

export default function ServicesEditor({ initial, equipe }: { initial: ServiceRow[]; equipe: Personne[] }) {
  const router = useRouter();
  const [services, setServices] = useState(initial);
  const [nouveau, setNouveau] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const nomDe = (id: string) => equipe.find((p) => p.id === id)?.full_name ?? "Compte retiré";

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    if (!nouveau.trim()) return;
    setErr(null); setOccupe("nouveau");
    try {
      const { service } = await appel("/api/tickets/services", "POST", { nom: nouveau });
      setServices((s) => [...s, service]); setNouveau(""); setOuvert(service.id);
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    setOccupe(null);
  }

  async function basculerMembre(svc: ServiceRow, profileId: string) {
    const membres = svc.membres.includes(profileId) ? svc.membres.filter((m) => m !== profileId) : [...svc.membres, profileId];
    setErr(null); setOccupe(svc.id);
    try {
      await appel(`/api/tickets/services/${svc.id}`, "PATCH", { membres });
      setServices((ss) => ss.map((s) => (s.id === svc.id ? { ...s, membres } : s)));
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    setOccupe(null);
  }

  async function renommer(svc: ServiceRow, nom: string) {
    if (nom.trim() === svc.nom) return;
    setErr(null); setOccupe(svc.id);
    try {
      await appel(`/api/tickets/services/${svc.id}`, "PATCH", { nom });
      setServices((ss) => ss.map((s) => (s.id === svc.id ? { ...s, nom: nom.trim() } : s)));
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    setOccupe(null);
  }

  async function supprimer(svc: ServiceRow) {
    if (!window.confirm(`Supprimer le service « ${svc.nom} » ? Les tickets rattachés gardent leur historique mais ne seront plus visibles « par service ».`)) return;
    setErr(null); setOccupe(svc.id);
    try {
      await appel(`/api/tickets/services/${svc.id}`, "DELETE");
      setServices((ss) => ss.filter((s) => s.id !== svc.id));
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    setOccupe(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {err && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--destructive)" }}>{err}</p>}

      {services.length === 0 && (
        <div className="civiq-card" style={{ padding: 20, borderStyle: "dashed", color: "var(--fg-muted)", fontSize: 13.5 }}>
          Aucun service pour l&apos;instant. Créez par exemple « Services techniques », « Périscolaire », « Administratif ».
        </div>
      )}

      {services.map((svc) => {
        const estOuvert = ouvert === svc.id;
        return (
          <div key={svc.id} className="civiq-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 220px", minWidth: 0 }}>
                <span className="tk-sr-only">Nom du service</span>
                <input
                  defaultValue={svc.nom}
                  onBlur={(e) => renommer(svc, e.target.value)}
                  className="civiq-input"
                  style={{ fontWeight: 600, fontSize: 14.5 }}
                />
              </label>
              <button
                type="button"
                className="civiq-btn civiq-btn-outline"
                aria-expanded={estOuvert}
                onClick={() => setOuvert(estOuvert ? null : svc.id)}
                style={{ fontSize: 13 }}
              >
                <Users size={14} aria-hidden="true" /> {svc.membres.length} membre{svc.membres.length > 1 ? "s" : ""}
              </button>
              <button type="button" className="civiq-btn civiq-btn-ghost" onClick={() => supprimer(svc)} aria-label={`Supprimer le service ${svc.nom}`} disabled={occupe === svc.id}>
                {occupe === svc.id ? <Loader2 size={14} className="civiq-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
            {!estOuvert && svc.membres.length > 0 && (
              <p style={{ margin: 0, padding: "0 14px 12px", fontSize: 12.5, color: "var(--fg-muted)" }}>
                {svc.membres.map(nomDe).join(", ")}
              </p>
            )}
            {estOuvert && (
              <fieldset style={{ border: 0, borderTop: "1px solid var(--border-light)", margin: 0, padding: "10px 14px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 4 }}>
                <legend className="tk-sr-only">Membres du service {svc.nom}</legend>
                {equipe.map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", minHeight: 40, cursor: "pointer" }}>
                    <input type="checkbox" checked={svc.membres.includes(p.id)} disabled={occupe === svc.id} onChange={() => basculerMembre(svc, p.id)} style={{ width: 18, height: 18 }} />
                    <span style={{ fontSize: 13.5 }}>{p.full_name ?? "Sans nom"}</span>
                    <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{p.job_title ? FONCTION_LABEL[p.job_title] ?? p.job_title : "Fonction non renseignée"}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        );
      })}

      <form onSubmit={creer} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 240px" }}>
          <span className="tk-sr-only">Nom du nouveau service</span>
          <input value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder="Nouveau service (ex. Services techniques)" className="civiq-input" maxLength={80} />
        </label>
        <button type="submit" className="civiq-btn civiq-btn-default" disabled={!nouveau.trim() || occupe === "nouveau"}>
          {occupe === "nouveau" ? <Loader2 size={14} className="civiq-spin" /> : <Plus size={14} />} Ajouter le service
        </button>
      </form>
    </div>
  );
}
