"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-icon">📧</div>
          <h1>Email envoyé</h1>
          <p>
            Si un compte existe avec l'adresse <strong>{email}</strong>, vous
            recevrez un lien pour réinitialiser votre mot de passe.
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
        <h1>Mot de passe oublié</h1>
        <p className="auth-desc">
          Saisissez votre email et nous vous enverrons un lien pour
          réinitialiser votre mot de passe.
        </p>

        <form onSubmit={handleReset}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maire@commune.fr"
              required
              autoComplete="email"
            />
          </div>

          <button type="submit" disabled={loading || !email} className="auth-btn">
            {loading ? "Envoi…" : "Envoyer le lien de réinitialisation"}
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/auth/login">← Retour à la connexion</Link>
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
        max-width: 420px;
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
        font-size: 26px;
        font-weight: 700;
        color: #1a2744;
        margin-bottom: 8px;
      }
      .auth-desc { font-size: 14px; color: #888; margin-bottom: 28px; line-height: 1.5; }
      .auth-icon { font-size: 48px; margin-bottom: 20px; }
      .auth-field { margin-bottom: 20px; }
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
