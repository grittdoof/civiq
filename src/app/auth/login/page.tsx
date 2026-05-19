"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (password) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/admin/dashboard");
      }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setOtpSent(true);
      }
    }

    setLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const token = otp.replace(/\s+/g, "");
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/admin/dashboard");
      router.refresh();
    }
  }

  if (otpSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-icon">🔐</div>
          <h1>Entrez votre code</h1>
          <p className="auth-desc">
            Un code à 6 chiffres a été envoyé à <strong>{email}</strong>.
            Recopiez-le ci-dessous pour vous connecter.
          </p>

          <form onSubmit={handleVerifyOtp}>
            {error && <div className="auth-error">{error}</div>}

            <div className="auth-field">
              <label>Code de vérification</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                autoFocus
                required
                style={{ letterSpacing: "8px", fontSize: "20px", textAlign: "center", fontWeight: 600 }}
              />
            </div>

            <button type="submit" disabled={loading || otp.length !== 6} className="auth-btn">
              {loading ? "Vérification…" : "Se connecter"}
            </button>
          </form>

          <button
            onClick={() => {
              setOtpSent(false);
              setOtp("");
              setError(null);
            }}
            className="auth-link"
          >
            ← Utiliser une autre adresse
          </button>
        </div>
        <AuthStyles />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          🏛 GoCiviQ
        </Link>
        <h1>Connexion</h1>
        <p className="auth-desc">
          Accédez à votre espace d'administration communal.
        </p>

        <form onSubmit={handleLogin}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maire@commune.fr"
              required
            />
          </div>

          <div className="auth-field">
            <label>
              Mot de passe{" "}
              <span className="optional">(laisser vide pour recevoir un code)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading || !email} className="auth-btn">
            {loading
              ? "Connexion…"
              : password
              ? "Se connecter"
              : "Recevoir un code par email"}
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/auth/reset-password" className="auth-forgot">
            Mot de passe oublié ?
          </Link>
        </p>
        <p className="auth-footer">
          Pas encore de compte ?{" "}
          <Link href="/auth/register">Créer un espace commune</Link>
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
      .auth-desc { font-size: 14px; color: #888; margin-bottom: 28px; }
      .auth-icon { font-size: 48px; margin-bottom: 20px; }
      .auth-field { margin-bottom: 16px; }
      .auth-field label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #1a2744;
        margin-bottom: 6px;
      }
      .optional { font-weight: 400; color: #bbb; }
      .auth-field input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #e8e5de;
        border-radius: 8px;
        font-family: inherit;
        font-size: 15px;
        outline: none;
        transition: 0.2s;
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
      .auth-footer {
        text-align: center;
        font-size: 14px;
        color: #888;
        margin-top: 24px;
      }
      .auth-footer a { color: #3b6fa0; text-decoration: none; font-weight: 600; }
      .auth-link { background: none; border: none; color: #3b6fa0; cursor: pointer; font-size: 14px; margin-top: 16px; }
      .auth-forgot { color: #888; font-size: 13px; text-decoration: none; }
      .auth-forgot:hover { color: #3b6fa0; }
    `}</style>
  );
}
