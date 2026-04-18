"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SetupPage() {
  const router = useRouter();
  const [communeName, setCommuneName] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1a2744");
  const [accentColor, setAccentColor] = useState("#c9a84c");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!communeName.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commune_name: communeName.trim(),
          code_postal: codePostal.trim(),
          contact_email: contactEmail.trim(),
          primary_color: primaryColor,
          accent_color: accentColor,
        }),
      });

      if (res.ok) {
        router.push("/admin/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "Une erreur est survenue.");
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        <Link href="/" className="setup-logo">
          🏛 CiviQ
        </Link>

        <div className="setup-step-badge">Étape 2 / 2</div>
        <h1>Configurez votre espace commune</h1>
        <p className="setup-desc">
          Ces informations apparaîtront sur vos sondages et dans vos
          communications avec les administrés.
        </p>

        <form onSubmit={handleSetup}>
          {error && <div className="setup-error">{error}</div>}

          <div className="setup-field">
            <label>
              Nom de la commune <span className="req">*</span>
            </label>
            <input
              type="text"
              value={communeName}
              onChange={(e) => setCommuneName(e.target.value)}
              placeholder="Ex : Châteauneuf"
              required
            />
          </div>

          <div className="setup-row">
            <div className="setup-field">
              <label>Code postal</label>
              <input
                type="text"
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
                placeholder="85700"
                maxLength={5}
                pattern="[0-9]{5}"
              />
            </div>
            <div className="setup-field">
              <label>Email de contact</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="mairie@commune.fr"
              />
            </div>
          </div>

          <div className="setup-colors">
            <h3>Identité visuelle</h3>
            <p className="setup-colors-hint">
              Ces couleurs seront utilisées sur vos sondages publics.
            </p>
            <div className="setup-row">
              <div className="setup-field">
                <label>Couleur principale</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="color-input"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="color-text"
                    placeholder="#1a2744"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              </div>
              <div className="setup-field">
                <label>Couleur d'accent</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="color-input"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="color-text"
                    placeholder="#c9a84c"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div
              className="color-preview"
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
              }}
            >
              <span
                className="color-preview-badge"
                style={{ borderColor: `${accentColor}60` }}
              >
                Commune de {communeName || "…"}
              </span>
              <strong>Aperçu de l'en-tête de sondage</strong>
              <p>Voici comment apparaîtra votre commune sur les sondages.</p>
              <div
                className="color-preview-btn"
                style={{ background: accentColor, color: primaryColor }}
              >
                Continuer →
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !communeName.trim()}
            className="setup-btn"
          >
            {loading ? "Création de votre espace…" : "Accéder à mon tableau de bord →"}
          </button>
        </form>
      </div>

      <style>{`
        .setup-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a2744 0%, #243a5e 50%, #3b6fa0 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          font-family: 'Source Sans 3', -apple-system, sans-serif;
        }
        .setup-card {
          background: #fff;
          border-radius: 16px;
          padding: 40px;
          width: 100%;
          max-width: 560px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .setup-logo {
          display: block;
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 700;
          color: #1a2744;
          text-decoration: none;
          margin-bottom: 20px;
        }
        .setup-step-badge {
          display: inline-block;
          background: #e6f1fb;
          color: #3b6fa0;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 20px;
          margin-bottom: 12px;
        }
        .setup-card h1 {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 700;
          color: #1a2744;
          margin-bottom: 8px;
        }
        .setup-desc { font-size: 14px; color: #888; margin-bottom: 28px; line-height: 1.5; }
        .setup-field { margin-bottom: 16px; flex: 1; }
        .setup-field label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #1a2744;
          margin-bottom: 6px;
        }
        .req { color: #c0392b; }
        .setup-field input[type="text"],
        .setup-field input[type="email"] {
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
        .setup-field input:focus { border-color: #3b6fa0; box-shadow: 0 0 0 3px rgba(59,111,160,0.1); }
        .setup-row { display: flex; gap: 16px; }
        @media (max-width: 500px) { .setup-row { flex-direction: column; } }

        .setup-colors { margin-top: 8px; margin-bottom: 24px; }
        .setup-colors h3 { font-size: 16px; font-weight: 600; color: #1a2744; margin-bottom: 4px; }
        .setup-colors-hint { font-size: 13px; color: #888; margin-bottom: 16px; }

        .color-picker-row { display: flex; align-items: center; gap: 10px; }
        .color-input { width: 44px; height: 44px; border: 2px solid #e8e5de; border-radius: 8px; cursor: pointer; padding: 2px; background: none; }
        .color-text {
          flex: 1;
          padding: 10px 14px;
          border: 2px solid #e8e5de;
          border-radius: 8px;
          font-family: monospace;
          font-size: 14px;
          outline: none;
          transition: 0.2s;
        }
        .color-text:focus { border-color: #3b6fa0; }

        .color-preview {
          margin-top: 16px;
          border-radius: 12px;
          padding: 24px;
          color: #fff;
          transition: 0.3s;
        }
        .color-preview-badge {
          display: inline-block;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 40px;
          padding: 4px 14px;
          font-size: 12px;
          margin-bottom: 12px;
        }
        .color-preview strong { display: block; font-size: 18px; font-weight: 700; margin-bottom: 6px; }
        .color-preview p { font-size: 13px; opacity: 0.8; margin-bottom: 16px; }
        .color-preview-btn {
          display: inline-flex;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
        }

        .setup-btn {
          width: 100%;
          padding: 15px;
          border-radius: 8px;
          background: linear-gradient(135deg, #1a2744, #3b6fa0);
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: 0.2s;
          margin-top: 8px;
        }
        .setup-btn:hover { opacity: 0.9; }
        .setup-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .setup-error {
          background: #fef2f2;
          color: #991b1b;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
}
