"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Phase = "credentials" | "otp-sent";

// Next.js 15 exige que useSearchParams() soit dans un Suspense boundary
// pour le prerender statique. On wrap le composant ici.
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-card">Chargement…</div></div>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [phase, setPhase] = useState<Phase>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown 30 s pour le bouton "renvoyer"
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function sendOtp() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // shouldCreateUser: false → on n'autorise pas la création silencieuse
        // d'utilisateur via OTP. L'inscription passe par /auth/register.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback${
          next ? `?next=${encodeURIComponent(next)}` : ""
        }`,
      },
    });
    if (error) throw error;
  }

  async function handleCredentialSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    try {
      if (password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next && next.startsWith("/") ? next : "/admin/dashboard");
      } else {
        await sendOtp();
        setPhase("otp-sent");
        setResendCooldown(30);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (otp.length !== 6) {
      setError("Le code doit comporter 6 chiffres");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      if (error) throw error;

      // Profil + redirection
      const r = await fetch("/api/auth/post-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next }),
      });
      if (!r.ok) throw new Error("Erreur de session");
      const { redirectTo } = await r.json();
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide ou expiré");
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      await sendOtp();
      setResendCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'envoi");
    } finally {
      setLoading(false);
    }
  }

  if (phase === "otp-sent") {
    return (
      <OtpScreen
        email={email}
        otp={otp}
        setOtp={setOtp}
        loading={loading}
        error={error}
        resendCooldown={resendCooldown}
        onSubmit={handleOtpSubmit}
        onResend={handleResend}
        onBack={() => {
          setPhase("credentials");
          setOtp("");
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo" aria-label="GoCiviq" style={{ display: "inline-flex", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-horizontal.svg" alt="GoCiviq" style={{ height: 60, width: "auto" }} />
        </Link>
        <h1>Connexion</h1>
        <p className="auth-desc">
          Accédez à votre espace d&apos;administration communal.
        </p>

        <form onSubmit={handleCredentialSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maire@commune.fr"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label>
              Mot de passe{" "}
              <span className="optional">(laisser vide pour un code par email)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
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
          <Link href="/auth/register">Créer un compte maintenant</Link>
        </p>
      </div>
      <AuthStyles />
    </div>
  );
}

function OtpScreen({
  email,
  otp,
  setOtp,
  loading,
  error,
  resendCooldown,
  onSubmit,
  onResend,
  onBack,
}: {
  email: string;
  otp: string;
  setOtp: (v: string) => void;
  loading: boolean;
  error: string | null;
  resendCooldown: number;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-icon">🔐</div>
        <h1>Vérification</h1>
        <p className="auth-desc">
          Un code à 6 chiffres a été envoyé à <strong>{email}</strong>.
          <br />
          Saisissez-le ci-dessous pour vous connecter.
        </p>

        <form onSubmit={onSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label htmlFor="otp">Code de vérification</label>
            <input
              ref={inputRef}
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className="auth-otp-input"
              required
            />
          </div>

          <button type="submit" disabled={loading || otp.length !== 6} className="auth-btn">
            {loading ? "Vérification…" : "Vérifier le code"}
          </button>
        </form>

        <p className="auth-footer">
          <button
            type="button"
            onClick={onResend}
            disabled={resendCooldown > 0 || loading}
            className="auth-link"
          >
            {resendCooldown > 0
              ? `Renvoyer dans ${resendCooldown} s`
              : "Renvoyer un code"}
          </button>
        </p>
        <p className="auth-footer">
          <button type="button" onClick={onBack} className="auth-link">
            ← Changer d&apos;adresse email
          </button>
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
      .auth-icon { font-size: 48px; margin-bottom: 20px; text-align: center; }
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
      .auth-otp-input {
        text-align: center;
        font-size: 28px !important;
        letter-spacing: 12px;
        font-weight: 700;
        font-family: 'Courier New', monospace !important;
        color: #1a2744;
      }
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
      .auth-link {
        background: none;
        border: none;
        color: #3b6fa0;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        font-family: inherit;
      }
      .auth-link:disabled { color: #aaa; cursor: not-allowed; }
      .auth-forgot { color: #888; font-size: 13px; text-decoration: none; }
      .auth-forgot:hover { color: #3b6fa0; }
    `}</style>
  );
}
