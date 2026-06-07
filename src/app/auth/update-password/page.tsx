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
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase recovery utilise le flux implicit : hash de la forme
    //   #access_token=…&type=recovery
    // ou en cas d'échec
    //   #error=access_denied&error_code=otp_expired&error_description=…
    // On parse le hash pour détecter les erreurs avant d'attendre la session.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const code = params.get("error_code");
      const desc = params.get("error_description") || "Le lien est invalide ou a expiré.";
      if (code === "otp_expired" || desc.toLowerCase().includes("expired")) {
        setLinkError("Ce lien de réinitialisation a expiré. Les liens sont valides pendant 1 heure et à usage unique — merci d'en redemander un.");
      } else {
        setLinkError(desc.replace(/\+/g, " "));
      }
      return;
    }

    // Supabase injecte la session depuis le lien magique dans le hash de l'URL
    // On attend que le client soit prêt
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
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

  if (linkError) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-icon">⏰</div>
          <h1>Lien expiré</h1>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>
            {linkError}
          </p>
          <Link href="/auth/reset-password" className="auth-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            Demander un nouveau lien
          </Link>
        </div>
        <AuthStyles />
      </div>
    );
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
          <img src="/brand/logo-horizontal.svg" alt="GoCiviq" style={{ height: 60, width: "auto" }} />
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
