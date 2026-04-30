"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Save, Info } from "lucide-react";

interface Settings {
  editor_name: string | null;
  editor_legal_form: string | null;
  editor_siret: string | null;
  editor_address: string | null;
  editor_email: string | null;
  editor_phone: string | null;
  legal_rep_name: string | null;
  legal_rep_role: string | null;
  host_name: string | null;
  host_address: string | null;
  host_phone: string | null;
  dpo_name: string | null;
  dpo_email: string | null;
  cnil_ref: string | null;
  privacy_email: string | null;
  retention_default_days: number | null;
}

const EMPTY: Settings = {
  editor_name: "", editor_legal_form: "", editor_siret: "", editor_address: "", editor_email: "", editor_phone: "",
  legal_rep_name: "", legal_rep_role: "",
  host_name: "", host_address: "", host_phone: "",
  dpo_name: "", dpo_email: "",
  cnil_ref: "", privacy_email: "", retention_default_days: 365,
};

export default function RgpdSettingsPage() {
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/super-admin/rgpd")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSettings({ ...EMPTY, ...d }); })
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setSettings((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/super-admin/rgpd", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) {
      setSavedAt(new Date().toLocaleTimeString("fr-FR"));
      setTimeout(() => setSavedAt(null), 3000);
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Erreur de sauvegarde");
    }
  }

  if (loading) return <main className="rgpd-page"><p>Chargement…</p></main>;

  return (
    <main className="rgpd-page">
      <header style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.03em" }}>Conformité RGPD</h1>
            <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Informations légales utilisées dans les mentions, la politique de confidentialité et les sondages.</p>
          </div>
        </div>
        <div style={{ background: "var(--accent-light)", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)", padding: "10px 14px", display: "flex", gap: 10, fontSize: 13, color: "var(--fg)" }}>
          <Info size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
          <span>
            Ces informations sont publiquement consultables sur les pages <code>/mentions-legales</code> et <code>/confidentialite</code>. Elles seront aussi affichées avant chaque consentement de sondage.
          </span>
        </div>
      </header>

      <Section title="Éditeur de la plateforme">
        <Grid2>
          <Field label="Raison sociale" value={settings.editor_name} onChange={(v) => set("editor_name", v)} placeholder="Société Civic SAS" />
          <Field label="Forme juridique" value={settings.editor_legal_form} onChange={(v) => set("editor_legal_form", v)} placeholder="SAS, SARL, association…" />
          <Field label="SIRET" value={settings.editor_siret} onChange={(v) => set("editor_siret", v)} placeholder="123 456 789 00012" />
          <Field label="Email" value={settings.editor_email} onChange={(v) => set("editor_email", v)} placeholder="contact@…" type="email" />
          <Field label="Téléphone" value={settings.editor_phone} onChange={(v) => set("editor_phone", v)} placeholder="+33 …" type="tel" />
        </Grid2>
        <Field full label="Adresse" value={settings.editor_address} onChange={(v) => set("editor_address", v)} multiline placeholder="N° rue, code postal ville, pays" />
      </Section>

      <Section title="Représentant légal">
        <Grid2>
          <Field label="Nom" value={settings.legal_rep_name} onChange={(v) => set("legal_rep_name", v)} />
          <Field label="Fonction" value={settings.legal_rep_role} onChange={(v) => set("legal_rep_role", v)} placeholder="Président, Directeur de publication…" />
        </Grid2>
      </Section>

      <Section title="Hébergeur">
        <Grid2>
          <Field label="Hébergeur" value={settings.host_name} onChange={(v) => set("host_name", v)} placeholder="Vercel Inc., OVH…" />
          <Field label="Téléphone" value={settings.host_phone} onChange={(v) => set("host_phone", v)} type="tel" />
        </Grid2>
        <Field full label="Adresse" value={settings.host_address} onChange={(v) => set("host_address", v)} multiline />
      </Section>

      <Section title="Délégué à la protection des données (DPO)">
        <Grid2>
          <Field label="Nom" value={settings.dpo_name} onChange={(v) => set("dpo_name", v)} placeholder="Optionnel" />
          <Field label="Email" value={settings.dpo_email} onChange={(v) => set("dpo_email", v)} placeholder="dpo@…" type="email" />
        </Grid2>
      </Section>

      <Section title="Conformité & droits">
        <Grid2>
          <Field label="Référence CNIL" value={settings.cnil_ref} onChange={(v) => set("cnil_ref", v)} placeholder="ex : Mission de service public" />
          <Field label="Email exercice des droits" value={settings.privacy_email} onChange={(v) => set("privacy_email", v)} placeholder="rgpd@…" type="email" />
          <Field
            label="Durée de conservation par défaut (jours)"
            value={String(settings.retention_default_days ?? "")}
            onChange={(v) => set("retention_default_days", v === "" ? null : Number(v))}
            type="number"
          />
        </Grid2>
      </Section>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "20px 0", position: "sticky", bottom: 0, background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
        {savedAt && <span style={{ fontSize: 13, color: "var(--success)", alignSelf: "center" }}>✓ Enregistré à {savedAt}</span>}
        <button type="button" onClick={save} disabled={saving} className="civiq-btn civiq-btn-default">
          <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      <style>{`
        .rgpd-page { max-width: 880px; margin: 0 auto; padding: 32px 28px 80px; }
      `}</style>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 10 }}>
        {title}
      </h2>
      <div className="civiq-card" style={{ padding: 18, display: "grid", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = "text", multiline, full }: {
  label: string; value: string | null; onChange: (v: string) => void;
  placeholder?: string; type?: string; multiline?: boolean; full?: boolean;
}) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label className="civiq-field-label" style={{ fontSize: 12 }}>{label}</label>
      {multiline ? (
        <textarea className="civiq-input civiq-textarea" rows={2} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input type={type} className="civiq-input" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}
