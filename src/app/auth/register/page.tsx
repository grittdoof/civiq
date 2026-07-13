"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════
// /auth/register — Inscription complète : profil + intention commune
//
// Depuis ce point d'entrée, l'utilisateur déclare directement :
//   • son identité (email, nom, fonction)
//   • son intention commune : rejoindre une existante OU en créer
//     une nouvelle
//
// L'intention est stockée en user_metadata (Supabase Auth). À la
// confirmation email (/auth/callback → resolvePostLoginRedirect),
// un commune_request status='pending' est créé automatiquement à
// partir de ces métadonnées. Le super-admin le voit immédiatement
// dans /super-admin/commune-requests et peut approuver / rejeter.
// ═══════════════════════════════════════════════════════════════

interface CommuneOption {
  id: string;
  name: string;
  slug: string;
  code_postal: string | null;
}

const FUNCTIONS = [
  { value: "maire", label: "Maire" },
  { value: "adjoint", label: "Adjoint·e au maire" },
  { value: "conseiller", label: "Conseiller·e municipal" },
  { value: "dgs", label: "DGS / Direction" },
  { value: "secretaire", label: "Secrétaire de mairie" },
  { value: "agent", label: "Agent territorial" },
  { value: "agent_technique", label: "Agent technique" },
  { value: "autre", label: "Autre" },
];

type Choice = "join" | "create";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("maire");
  const [choice, setChoice] = useState<Choice>("create");
  const [joinCommuneId, setJoinCommuneId] = useState("");
  const [createCommuneName, setCreateCommuneName] = useState("");
  const [createCommuneCP, setCreateCommuneCP] = useState("");
  const [communes, setCommunes] = useState<CommuneOption[]>([]);
  const [loadingCommunes, setLoadingCommunes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setLoadingCommunes(true);
    fetch("/api/communes/public")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCommunes(Array.isArray(d) ? d : []))
      .finally(() => setLoadingCommunes(false));
  }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Votre nom complet est requis.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (choice === "join" && !joinCommuneId) {
      setError("Sélectionnez la commune à rejoindre.");
      return;
    }
    if (choice === "create" && !createCommuneName.trim()) {
      setError("Le nom de la nouvelle commune est requis.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName.trim(),
          job_title: jobTitle,
          signup_intent: "commune",
          commune_choice: choice,
          join_commune_id: choice === "join" ? joinCommuneId : null,
          create_commune_name: choice === "create" ? createCommuneName.trim() : null,
          create_commune_code_postal:
            choice === "create" ? createCommuneCP.trim() || null : null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setDone(true);
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-icon">📧</div>
          <h1>Vérifiez votre boîte mail</h1>
          <p>
            Un lien de confirmation a été envoyé à <strong>{email}</strong>.
            <br />
            Cliquez sur ce lien pour finaliser votre inscription.
          </p>
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--fg-muted)" }}>
            Votre demande de{" "}
            {choice === "join"
              ? "rattachement"
              : "création d'espace commune"}{" "}
            sera ensuite examinée par un super-administrateur. Vous
            recevrez une notification par email dès validation.
          </p>
          <Link href="/auth/login" className="auth-link-btn">
            ← Retour à la connexion
          </Link>
        </div>
        <AuthStyles />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-horizontal.svg"
            alt="GoCiviq"
            style={{ height: 60, width: "auto" }}
          />
        </Link>
        <h1>Créer votre compte</h1>
        <p className="auth-desc">
          Inscription gratuite. Vous devez indiquer votre commune de
          rattachement pour accéder à toutes les fonctionnalités —
          un super-administrateur valide chaque demande.
        </p>

        <form onSubmit={handleRegister}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Nom complet *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Jeanne Dupont"
            />
          </div>

          <div className="auth-field">
            <label>Votre fonction *</label>
            <select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}>
              {FUNCTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className="auth-field">
            <label>Adresse email professionnelle *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="vous@commune.fr"
            />
          </div>

          <div className="auth-field">
            <label>Mot de passe *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="8 caractères minimum"
            />
          </div>

          <div className="auth-field">
            <label>Confirmer le mot de passe *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="auth-choice">
            <div className="auth-choice-title">Votre commune</div>
            <label className={`auth-choice-opt${choice === "create" ? " is-selected" : ""}`}>
              <input
                type="radio"
                name="choice"
                value="create"
                checked={choice === "create"}
                onChange={() => setChoice("create")}
              />
              <div>
                <strong>Créer un nouvel espace commune</strong>
                <span>Votre commune n'est pas encore sur GoCiviq — je la mets en place.</span>
              </div>
            </label>
            <label className={`auth-choice-opt${choice === "join" ? " is-selected" : ""}`}>
              <input
                type="radio"
                name="choice"
                value="join"
                checked={choice === "join"}
                onChange={() => setChoice("join")}
              />
              <div>
                <strong>Rejoindre une commune existante</strong>
                <span>Ma commune est déjà présente — je demande à la rejoindre.</span>
              </div>
            </label>
          </div>

          {choice === "join" ? (
            <div className="auth-field">
              <label>Commune à rejoindre *</label>
              <select
                value={joinCommuneId}
                onChange={(e) => setJoinCommuneId(e.target.value)}
                required
                disabled={loadingCommunes}
              >
                <option value="">
                  {loadingCommunes ? "Chargement…" : "— Sélectionner —"}
                </option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code_postal ? `(${c.code_postal})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="auth-field">
                <label>Nom de la commune *</label>
                <input
                  type="text"
                  value={createCommuneName}
                  onChange={(e) => setCreateCommuneName(e.target.value)}
                  required
                  placeholder="Ex : Châteauneuf"
                />
              </div>
              <div className="auth-field">
                <label>Code postal (optionnel)</label>
                <input
                  type="text"
                  value={createCommuneCP}
                  onChange={(e) => setCreateCommuneCP(e.target.value)}
                  placeholder="12345"
                  maxLength={5}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-submit"
          >
            {loading ? "Envoi…" : "Créer mon compte"}
          </button>
        </form>

        <div className="auth-footer-links">
          Déjà inscrit·e ?{" "}
          <Link href="/auth/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Se connecter
          </Link>
        </div>
      </div>
      <AuthStyles />
    </div>
  );
}

function AuthStyles() {
  return (
    <style>{`
      .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: linear-gradient(135deg, oklch(0.18 0.04 258), oklch(0.13 0.025 258)); }
      .auth-card { width: 100%; max-width: 460px; background: var(--card, #fff); border-radius: var(--radius, 16px); padding: 32px 28px; box-shadow: 0 20px 60px oklch(0 0 0 / 0.3); }
      .auth-logo { display: block; text-align: center; margin-bottom: 14px; }
      .auth-card h1 { font-size: 22px; font-weight: 700; color: var(--fg, #1a2744); margin: 0 0 6px; letter-spacing: -0.02em; text-align: center; }
      .auth-desc { font-size: 13.5px; color: var(--fg-muted, #666); line-height: 1.55; text-align: center; margin: 0 0 20px; }
      .auth-icon { font-size: 40px; text-align: center; margin-bottom: 8px; }
      .auth-field { display: grid; gap: 6px; margin-bottom: 14px; }
      .auth-field label { font-size: 13px; font-weight: 600; color: var(--fg, #1a2744); }
      .auth-field input, .auth-field select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border, #e2dfd6);
        border-radius: 10px;
        font-size: 14px;
        font-family: inherit;
        background: var(--card, #fff);
        color: var(--fg, #1a2744);
      }
      .auth-field input:focus, .auth-field select:focus {
        outline: none;
        border-color: var(--civiq-primary, #1a2744);
        box-shadow: 0 0 0 3px oklch(0.4 0.05 258 / 0.15);
      }
      .auth-choice { margin: 18px 0 14px; }
      .auth-choice-title { font-size: 13px; font-weight: 600; color: var(--fg, #1a2744); margin-bottom: 8px; }
      .auth-choice-opt {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 12px 14px; border: 1.5px solid var(--border, #e2dfd6);
        border-radius: 10px; cursor: pointer; margin-bottom: 8px;
        transition: border-color 0.12s, background 0.12s;
      }
      .auth-choice-opt.is-selected {
        border-color: var(--civiq-primary, #1a2744);
        background: var(--bg-soft, #faf9f6);
      }
      .auth-choice-opt input { margin-top: 3px; accent-color: var(--civiq-primary, #1a2744); }
      .auth-choice-opt strong { display: block; font-size: 13.5px; color: var(--fg, #1a2744); }
      .auth-choice-opt span { display: block; font-size: 12px; color: var(--fg-muted, #666); margin-top: 2px; line-height: 1.4; }
      .auth-submit {
        width: 100%; padding: 12px 22px; border: none;
        background: linear-gradient(135deg, #1a2744, #3b6fa0);
        color: #fff; font-size: 15px; font-weight: 600;
        border-radius: 10px; cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      .auth-submit:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(26,39,68,0.25);
      }
      .auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }
      .auth-error {
        background: oklch(0.97 0.04 25);
        border: 1px solid oklch(0.55 0.22 25);
        color: oklch(0.4 0.22 25);
        padding: 10px 12px; border-radius: 8px; font-size: 13px;
        margin-bottom: 12px;
      }
      .auth-link-btn {
        display: inline-block; margin-top: 16px; padding: 8px 14px;
        border: 1px solid var(--border, #e2dfd6); border-radius: 8px;
        color: var(--fg, #1a2744); text-decoration: none; font-size: 13.5px;
      }
      .auth-footer-links {
        margin-top: 18px; padding-top: 14px;
        border-top: 1px solid var(--border, #f0ede5);
        text-align: center; font-size: 13px; color: var(--fg-muted, #888);
      }
    `}</style>
  );
}
