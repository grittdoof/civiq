"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Landmark, Loader2, Plus } from "lucide-react";
import "../../admin/projects/projects.css";

// ═══════════════════════════════════════════════════════════════
// /super-admin/seuils — seuils nationaux de commande publique.
// Communs à toutes les communes, versionnés par date d'effet : une
// nouvelle valeur ne remplace jamais l'ancienne, elle la clôt. Un devis
// est toujours évalué avec le seuil en vigueur à la date de sa consultation.
// ═══════════════════════════════════════════════════════════════

interface SeuilRow {
  id: string;
  categorie: "travaux" | "fournitures_services";
  type: "dispense" | "seuil_europeen";
  montant_ht: number;
  date_effet: string;
  date_fin: string | null;
  reference: string | null;
  commentaire: string | null;
}

const CAT = { travaux: "Travaux", fournitures_services: "Fournitures et services" };
const TYPE = { dispense: "Dispense de publicité", seuil_europeen: "Seuil européen (procédure formalisée)" };
const eur = (n: number) => `${Number(n).toLocaleString("fr-FR")} €`;
const d = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—");

export default function SeuilsPage() {
  const [rows, setRows] = useState<SeuilRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ categorie: "travaux", type: "dispense", montant_ht: "", date_effet: "", reference: "" });
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const janvier = new Date().getMonth() === 0;

  async function load() {
    setLoading(true);
    const res = await fetch("/api/super-admin/seuils");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setRows(json.seuils ?? []);
    else setError(json.error ?? "Chargement impossible.");
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/super-admin/seuils", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Enregistrement impossible."); return; }
    setForm({ ...form, montant_ht: "", date_effet: "", reference: "" });
    void load();
  }

  return (
    <main className="rgpd-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Landmark size={20} aria-hidden="true" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", margin: 0 }}>Seuils de commande publique</h1>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0 }}>
            Valeurs nationales, communes à toutes les communes. Chaque devis est évalué avec le seuil en vigueur à la date de sa consultation.
          </p>
        </div>
      </header>

      {janvier && (
        <div className="pj-alerte pj-alerte-recommande" role="status">
          <p className="pj-alerte-registre"><AlertTriangle size={14} aria-hidden="true" /> Rappel annuel</p>
          <p className="pj-alerte-constat">Les seuils européens sont révisés tous les deux ans.</p>
          <p className="pj-alerte-consequence">Un seuil périmé ferait afficher de mauvaises obligations aux communes.</p>
          <ul className="pj-alerte-actions"><li>→ Vérifiez leur actualité (Journal officiel de l&apos;Union européenne) et ajoutez les nouvelles valeurs ci-dessous.</li></ul>
        </div>
      )}

      {error && <p className="pj-modal-error" role="alert">{error}</p>}

      <section className="civiq-card" style={{ padding: 20 }}>
        {loading ? <p>Chargement…</p> : (
          <div className="pj-table-wrap">
            <table className="pj-table">
              <caption className="pj-sr-only">Seuils de commande publique, toutes versions</caption>
              <thead>
                <tr><th scope="col">Catégorie</th><th scope="col">Type</th><th scope="col">Montant HT</th><th scope="col">Du</th><th scope="col">Au</th><th scope="col">Référence</th><th scope="col">État</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const enVigueur = r.date_effet <= today && (!r.date_fin || r.date_fin >= today);
                  const futur = r.date_effet > today;
                  return (
                    <tr key={r.id}>
                      <td>{CAT[r.categorie]}</td>
                      <td>{TYPE[r.type]}</td>
                      <td>{eur(r.montant_ht)}</td>
                      <td>{d(r.date_effet)}</td>
                      <td>{d(r.date_fin)}</td>
                      <td>{r.reference ?? "—"}</td>
                      <td>{enVigueur ? "En vigueur" : futur ? "À venir" : "Échu"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="civiq-card" style={{ padding: 20 }} aria-labelledby="add-seuil">
        <h2 id="add-seuil" className="pj-params-title">Nouvelle valeur</h2>
        <p className="pj-params-note">La valeur en cours pour la même catégorie et le même type prend fin la veille de la date d&apos;effet.</p>
        <form onSubmit={add} className="pj-params-grid" style={{ marginTop: 12 }}>
          <div className="civiq-field">
            <label htmlFor="s-cat" className="civiq-field-label">Catégorie</label>
            <select id="s-cat" className="civiq-select" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
              <option value="travaux">Travaux</option>
              <option value="fournitures_services">Fournitures et services</option>
            </select>
          </div>
          <div className="civiq-field">
            <label htmlFor="s-type" className="civiq-field-label">Type</label>
            <select id="s-type" className="civiq-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="dispense">Dispense de publicité</option>
              <option value="seuil_europeen">Seuil européen</option>
            </select>
          </div>
          <div className="civiq-field">
            <label htmlFor="s-montant" className="civiq-field-label">Montant hors taxes (HT)</label>
            <input id="s-montant" className="civiq-input" inputMode="decimal" required value={form.montant_ht} onChange={(e) => setForm({ ...form, montant_ht: e.target.value })} />
          </div>
          <div className="civiq-field">
            <label htmlFor="s-date" className="civiq-field-label">Date d&apos;effet</label>
            <input id="s-date" type="date" className="civiq-input" required value={form.date_effet} onChange={(e) => setForm({ ...form, date_effet: e.target.value })} />
          </div>
          <div className="civiq-field pj-params-note-wide">
            <label htmlFor="s-ref" className="civiq-field-label">Texte de référence</label>
            <input id="s-ref" className="civiq-input" placeholder="Ex. Décret n° … du …" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <div>
            <button type="submit" className="civiq-btn civiq-btn-default" disabled={saving}>
              {saving ? <Loader2 size={16} className="civiq-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} Ajouter
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
