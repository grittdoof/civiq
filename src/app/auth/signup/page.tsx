"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { ArrowRight, Check, Mail } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// /auth/signup — Inscription simple par magic link
//
//   • Email + nom + fonction (obligatoires)
//   • Crée le compte Supabase et envoie un magic link
//   • Le rôle par défaut sera « viewer » (administré) appliqué dans
//     /auth/callback à la création du profil
//   • Pas de mot de passe à choisir (passwordless)
// ═══════════════════════════════════════════════════════════════

const FUNCTIONS = [
  { value: "citoyen",     label: "Citoyen·ne / Administré·e" },
  { value: "associatif",  label: "Représentant·e d'association" },
  { value: "agent",       label: "Agent municipal" },
  { value: "conseiller",  label: "Conseiller·e municipal" },
  { value: "adjoint",     label: "Adjoint·e au maire" },
  { value: "maire",       label: "Maire" },
  { value: "dgs",         label: "DGS / Direction" },
  { value: "autre",       label: "Autre" },
];

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("citoyen");
  const [acceptCgu, setAcceptCgu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptCgu) {
      setErrorMsg("Veuillez accepter les CGU et la politique de confidentialité.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName || null,
          job_title: jobTitle,
          signup_intent: "user", // jamais 'commune' depuis ce flow
        },
      },
    });

    setBusy(false);
    if (error) {
      const m = (error.message || "").toLowerCase();
      if (m.includes("rate limit") || m.includes("rate_limit")) {
        setErrorMsg(
          "Limite d'envoi atteinte. Patientez quelques minutes ou contactez l'administrateur si le problème persiste."
        );
      } else if (m.includes("invalid")) {
        setErrorMsg("Adresse email invalide. Vérifiez et réessayez.");
      } else {
        setErrorMsg(error.message);
      }
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--success-light)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Check size={26} />
          </div>
          <h1 style={{ textAlign: "center" }}>Vérifiez votre boîte mail</h1>
          <p style={{ textAlign: "center", color: "var(--fg-muted)", marginBottom: 16 }}>
            Nous avons envoyé un lien de connexion à <strong>{email}</strong>.<br />
            Cliquez dessus pour finaliser votre inscription — pas de mot de passe à retenir.
          </p>
          <Link href="/auth/login" className="civiq-btn civiq-btn-outline" style={{ width: "100%", justifyContent: "center" }}>
            Retour à la connexion
          </Link>
        </div>
        <style>{authCss}</style>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo"><img src="/brand/logo-horizontal.svg" alt="GoCiviq" style={{ height: 60, width: "auto" }} /></Link>
        <h1>Créer mon compte</h1>
        <p style={{ color: "var(--fg-muted)", marginBottom: 20, fontSize: 14 }}>
          Inscription rapide, sans mot de passe : nous vous enverrons un lien magique par email.
        </p>

        {errorMsg && (
          <div style={{ background: "oklch(0.97 0.04 25)", border: "1px solid var(--destructive)", color: "var(--destructive)", padding: "10px 12px", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 12 }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label className="civiq-field-label">Email *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="civiq-input" placeholder="vous@exemple.fr" />
          </div>
          <div>
            <label className="civiq-field-label">Nom complet *</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="civiq-input" placeholder="Jeanne Dupont" />
          </div>
          <div>
            <label className="civiq-field-label">Votre fonction *</label>
            <select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="civiq-select">
              {FUNCTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <p className="civiq-field-hint" style={{ marginTop: 6 }}>
              Votre rôle initial est « administré ». Un administrateur de votre commune peut le faire évoluer si besoin.
            </p>
          </div>

          <label style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--fg)", padding: 12, background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", cursor: "pointer" }}>
            <input type="checkbox" checked={acceptCgu} onChange={(e) => setAcceptCgu(e.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ lineHeight: 1.5 }}>
              J&apos;accepte les <Link href="/mentions-legales" style={{ color: "var(--accent)" }}>mentions légales</Link> et la <Link href="/confidentialite" style={{ color: "var(--accent)" }}>politique de confidentialité</Link> RGPD.
            </span>
          </label>

          <button type="submit" disabled={busy || !email || !fullName || !acceptCgu} className="civiq-btn civiq-btn-default" style={{ justifyContent: "center", padding: "12px 22px", fontSize: 15 }}>
            <Mail size={15} /> {busy ? "Envoi…" : "Recevoir mon lien magique"}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", textAlign: "center", fontSize: 13, color: "var(--fg-muted)" }}>
          Vous représentez une commune ? <Link href="/auth/register" style={{ color: "var(--accent)", fontWeight: 600 }}>Créer un espace commune</Link>
        </div>
        <div style={{ marginTop: 8, textAlign: "center", fontSize: 13, color: "var(--fg-muted)" }}>
          Déjà inscrit·e ? <Link href="/auth/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Se connecter</Link>
        </div>
      </div>
      <style>{authCss}</style>
    </div>
  );
}

const authCss = `
  .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: linear-gradient(135deg, oklch(0.18 0.04 258), oklch(0.13 0.025 258)); }
  .auth-card { width: 100%; max-width: 440px; background: var(--card); border-radius: var(--radius); padding: 32px 28px; box-shadow: 0 20px 60px oklch(0 0 0 / 0.3); }
  .auth-logo { display: block; text-align: center; font-weight: 700; font-size: 20px; letter-spacing: -0.03em; color: var(--fg); text-decoration: none; margin-bottom: 14px; }
  .auth-card h1 { font-size: 22px; font-weight: 700; color: var(--fg); margin-bottom: 6px; letter-spacing: -0.02em; text-align: center; }
`;
