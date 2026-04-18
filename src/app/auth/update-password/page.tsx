"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase injecte la session depuis le lien magique dans le hash de l'URL
    // On attend que le client soit prêt
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Fallback : si déjà connecté via le lien, on est prêt
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
  }, []);

  async function handleUpdate(e: React.FormEvent) {
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

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      // Redirection après succès
      router.push("/admin/dashboard");
    }
  }

  if (!ready) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-icon">🔐</div>
          <h1>Vérification du lien…</h1>
          <p style={{ color: "#888", fontSize: 14 }}>
            Si cette page reste bloquée, le lien a peut-être expiré.{" "}
            <Link href="/auth/reset-password" style={{ color: "#3b6fa0" }}>
              Demander un nouveau lien
            </Link>
          </p>
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
        <h1>Nouveau mot de passe</h1>
        <p className="auth-desc">
          Choisissez un mot de passe sécurisé pour votre espace commune.
        </p>

        <form onSubmit={handleUpdate}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Nouveau mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Au moins 8 caractères"
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
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

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="auth-btn"
          >
            {loading ? "Mise à jour…" : "Mettre à jour mon mot de passe"}
          </button>
        </form>
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
      .auth-btn {
        width: 100%;
        padding: 14px;
        margin-top: 8px;
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
    `}</style>
  );
}
