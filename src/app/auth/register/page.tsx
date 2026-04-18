"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
            Cliquez sur le lien pour finaliser la création de votre espace commune.
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
          🏛 CiviQ
        </Link>
        <h1>Créer votre espace commune</h1>
        <p className="auth-desc">
          Inscription gratuite — votre première consultation en ligne en moins
          de 10 minutes.
        </p>

        <form onSubmit={handleRegister}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Adresse email professionnelle</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maire@commune.fr"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Au moins 8 caractères"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="auth-field">
            <label>Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>

          <p className="auth-hint">
            En créant un compte, vous acceptez les{" "}
            <a href="/mentions-legales">conditions d'utilisation</a> et la{" "}
            <a href="/confidentialite">politique de confidentialité</a>.
          </p>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="auth-btn"
          >
            {loading ? "Création du compte…" : "Créer mon compte →"}
          </button>
        </form>

        <p className="auth-footer">
          Déjà un compte ?{" "}
          <Link href="/auth/login">Se connecter</Link>
        </p>
      </div>
      <AuthStyles />
    </div>
  );
}

function AuthStyles() {
  return (
    <style>{`
      .auth-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1a2744 0%, #243a5e 50%, #3b6fa0 100%);
        padding: 24px;
        font-family: 'Source Sans 3', -apple-system, sans-serif;
      }
      .auth-card {
        background: #fff;
        border-radius: 16px;
        padding: 40px;
        width: 100%;
        max-width: 440px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      }
      .auth-logo {
        display: block;
        font-family: 'Playfair Display', serif;
        font-size: 22px;
        font-weight: 700;
        color: #1a2744;
        text-decoration: none;
        margin-bottom: 24px;
      }
      .auth-card h1 {
        font-family: 'Playfair Display', serif;
        font-size: 24px;
        font-weight: 700;
        color: #1a2744;
        margin-bottom: 8px;
      }
      .auth-desc { font-size: 14px; color: #888; margin-bottom: 28px; line-height: 1.5; }
      .auth-icon { font-size: 48px; margin-bottom: 20px; }
      .auth-field { margin-bottom: 16px; }
      .auth-field label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #1a2744;
        margin-bottom: 6px;
      }
      .auth-field input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #e8e5de;
        border-radius: 8px;
        font-family: inherit;
        font-size: 15px;
        outline: none;
        transition: 0.2s;
        box-sizing: border-box;
      }
      .auth-field input:focus { border-color: #3b6fa0; box-shadow: 0 0 0 3px rgba(59,111,160,0.1); }
      .auth-hint {
        font-size: 12px;
        color: #aaa;
        line-height: 1.5;
        margin-bottom: 16px;
      }
      .auth-hint a { color: #3b6fa0; text-decoration: none; }
      .auth-btn {
        width: 100%;
        padding: 14px;
        border-radius: 8px;
        background: linear-gradient(135deg, #1a2744, #3b6fa0);
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: 0.2s;
      }
      .auth-btn:hover { opacity: 0.9; }
      .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .auth-error {
        background: #fef2f2;
        color: #991b1b;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 13px;
        margin-bottom: 16px;
      }
      .auth-footer {
        text-align: center;
        font-size: 14px;
        color: #888;
        margin-top: 24px;
      }
      .auth-footer a { color: #3b6fa0; text-decoration: none; font-weight: 600; }
      .auth-link-btn {
        display: inline-block;
        margin-top: 20px;
        color: #3b6fa0;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
      }
    `}</style>
  );
}
