"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Save, Loader2, Check, KeyRound, Building2, User } from "lucide-react";

// ═══════════════════════════════════════════════════
// PROFILE & PARAMÈTRES — Gestion du profil admin
// + paramètres de la commune (nom, couleurs, contact)
// ═══════════════════════════════════════════════════

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ProfilePage() {
  // Commune settings
  const [communeId, setCommuneId] = useState<string | null>(null);
  const [communeName, setCommuneName] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1a2744");
  const [accentColor, setAccentColor] = useState("#c9a84c");

  // User profile
  const [fullName, setFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [communeSave, setCommuneSave] = useState<SaveState>("idle");
  const [profileSave, setProfileSave] = useState<SaveState>("idle");
  const [passwordSave, setPasswordSave] = useState<SaveState>("idle");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserEmail(user.email || "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, commune_id, communes(*)")
      .eq("id", user.id)
      .single();

    if (profile) {
      setFullName(profile.full_name || "");
      setCommuneId(profile.commune_id || null);

      const commune = profile.communes as Record<string, string> | null;
      if (commune) {
        setCommuneName(commune.name || "");
        setCodePostal(commune.code_postal || "");
        setContactEmail(commune.contact_email || "");
        setWebsiteUrl(commune.website_url || "");
        setPrimaryColor(commune.primary_color || "#1a2744");
        setAccentColor(commune.accent_color || "#c9a84c");
      }
    }
    setLoading(false);
  }

  async function saveCommune() {
    if (!communeId) return;
    setCommuneSave("saving");

    const supabase = createClient();
    const { error } = await supabase
      .from("communes")
      .update({
        name: communeName.trim(),
        code_postal: codePostal.trim() || null,
        contact_email: contactEmail.trim() || null,
        website_url: websiteUrl.trim() || null,
        primary_color: primaryColor,
        accent_color: accentColor,
      })
      .eq("id", communeId);

    setCommuneSave(error ? "error" : "saved");
    setTimeout(() => setCommuneSave("idle"), 2500);
  }

  async function saveProfile() {
    setProfileSave("saving");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("id", user.id);

    setProfileSave(error ? "error" : "saved");
    setTimeout(() => setProfileSave("idle"), 2500);
  }

  async function savePassword() {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas.");
      return;
    }

    setPasswordSave("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordSave("error");
      setPasswordError(error.message);
    } else {
      setPasswordSave("saved");
      setNewPassword("");
      setConfirmPassword("");
    }
    setTimeout(() => setPasswordSave("idle"), 2500);
  }

  if (loading) {
    return (
      <div className="profile-loading">
        <Loader2 size={28} className="spin" />
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>Profil &amp; paramètres</h1>
        <p>Gérez votre compte et les informations de votre commune.</p>
      </header>

      {/* ── Commune settings ── */}
      <section className="profile-card">
        <div className="profile-card-header">
          <div className="profile-card-icon">
            <Building2 size={20} />
          </div>
          <div>
            <h2>Paramètres de la commune</h2>
            <p>Ces informations apparaissent sur vos sondages publics.</p>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-field full">
            <label>Nom de la commune</label>
            <input
              type="text"
              value={communeName}
              onChange={(e) => setCommuneName(e.target.value)}
              className="profile-input"
            />
          </div>
          <div className="profile-field">
            <label>Code postal</label>
            <input
              type="text"
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value)}
              className="profile-input"
              placeholder="85710"
              maxLength={5}
            />
          </div>
          <div className="profile-field">
            <label>Email de contact public</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="profile-input"
              placeholder="mairie@commune.fr"
            />
          </div>
          <div className="profile-field full">
            <label>Site web de la commune</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="profile-input"
              placeholder="https://www.commune.fr"
            />
          </div>
        </div>

        {/* Colors */}
        <div className="profile-colors">
          <h3>Identité visuelle</h3>
          <div className="profile-grid">
            <div className="profile-field">
              <label>Couleur principale</label>
              <div className="color-row">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="color-swatch"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="profile-input color-hex"
                  placeholder="#1a2744"
                />
              </div>
            </div>
            <div className="profile-field">
              <label>Couleur d'accent</label>
              <div className="color-row">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="color-swatch"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="profile-input color-hex"
                  placeholder="#c9a84c"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div
            className="color-preview"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
          >
            <span className="color-preview-badge">{communeName || "Commune"}</span>
            <strong>Aperçu en-tête sondage</strong>
            <div
              className="color-preview-btn"
              style={{ background: accentColor, color: primaryColor }}
            >
              Continuer →
            </div>
          </div>
        </div>

        <div className="profile-card-footer">
          <SaveButton state={communeSave} onClick={saveCommune} label="Sauvegarder la commune" />
        </div>
      </section>

      {/* ── User profile ── */}
      <section className="profile-card">
        <div className="profile-card-header">
          <div className="profile-card-icon">
            <User size={20} />
          </div>
          <div>
            <h2>Votre profil</h2>
            <p>Informations personnelles liées à votre compte.</p>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-field">
            <label>Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="profile-input"
              placeholder="Prénom Nom"
            />
          </div>
          <div className="profile-field">
            <label>Adresse email (non modifiable)</label>
            <input
              type="email"
              value={userEmail}
              className="profile-input"
              disabled
              title="L'email ne peut pas être modifié ici"
            />
          </div>
        </div>

        <div className="profile-card-footer">
          <SaveButton state={profileSave} onClick={saveProfile} label="Sauvegarder le profil" />
        </div>
      </section>

      {/* ── Password ── */}
      <section className="profile-card">
        <div className="profile-card-header">
          <div className="profile-card-icon">
            <KeyRound size={20} />
          </div>
          <div>
            <h2>Changer de mot de passe</h2>
            <p>Laissez vide si vous ne souhaitez pas changer.</p>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-field">
            <label>Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="profile-input"
              placeholder="Au moins 8 caractères"
              autoComplete="new-password"
            />
          </div>
          <div className="profile-field">
            <label>Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="profile-input"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
        </div>

        {passwordError && (
          <div className="profile-error">{passwordError}</div>
        )}

        <div className="profile-card-footer">
          <SaveButton
            state={passwordSave}
            onClick={savePassword}
            label="Mettre à jour le mot de passe"
            disabled={!newPassword}
          />
        </div>
      </section>

      <style>{`
        .profile-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 32px 24px 60px;
          font-family: 'Source Sans 3', -apple-system, sans-serif;
        }
        .profile-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          color: #888;
          gap: 12px;
        }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .profile-header { margin-bottom: 28px; }
        .profile-header h1 {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 700;
          color: #1a2744;
          margin-bottom: 6px;
        }
        .profile-header p { font-size: 15px; color: #888; }

        .profile-card {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.04);
          margin-bottom: 20px;
          overflow: hidden;
        }
        .profile-card-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 20px 24px;
          border-bottom: 1px solid #f2efe8;
          background: #faf9f6;
        }
        .profile-card-icon {
          width: 40px; height: 40px;
          background: #e6f1fb;
          color: #3b6fa0;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .profile-card-header h2 {
          font-size: 16px;
          font-weight: 700;
          color: #1a2744;
          margin-bottom: 2px;
        }
        .profile-card-header p { font-size: 13px; color: #999; }

        .profile-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 20px 24px;
        }
        @media (max-width: 600px) { .profile-grid { grid-template-columns: 1fr; } }

        .profile-field { display: flex; flex-direction: column; gap: 6px; }
        .profile-field.full { grid-column: 1 / -1; }
        .profile-field label {
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .profile-input {
          padding: 10px 14px;
          border: 2px solid #e8e5de;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          color: #1a2744;
          background: #fff;
          outline: none;
          transition: 0.15s;
          width: 100%;
          box-sizing: border-box;
        }
        .profile-input:focus { border-color: #3b6fa0; box-shadow: 0 0 0 3px rgba(59,111,160,0.1); }
        .profile-input:disabled { background: #f5f5f5; color: #aaa; cursor: not-allowed; }

        /* Colors */
        .profile-colors { padding: 0 24px 20px; }
        .profile-colors h3 { font-size: 14px; font-weight: 600; color: #1a2744; margin-bottom: 12px; }
        .color-row { display: flex; align-items: center; gap: 10px; }
        .color-swatch {
          width: 44px; height: 44px;
          border: 2px solid #e8e5de;
          border-radius: 8px;
          cursor: pointer;
          padding: 2px;
          background: none;
          flex-shrink: 0;
        }
        .color-hex { flex: 1; font-family: monospace !important; }
        .color-preview {
          margin-top: 16px;
          border-radius: 10px;
          padding: 20px;
          color: #fff;
          transition: 0.3s;
        }
        .color-preview-badge {
          display: inline-block;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 40px;
          padding: 3px 12px;
          font-size: 12px;
          margin-bottom: 10px;
        }
        .color-preview strong { display: block; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
        .color-preview-btn {
          display: inline-flex;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
        }

        /* Footer */
        .profile-card-footer {
          padding: 16px 24px;
          border-top: 1px solid #f2efe8;
          display: flex;
          justify-content: flex-end;
        }
        .profile-error {
          margin: 0 24px 12px;
          background: #fef2f2;
          color: #991b1b;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
        }

        /* Save button */
        .save-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 22px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: 0.2s;
          font-family: inherit;
        }
        .save-btn.idle {
          background: linear-gradient(135deg, #1a2744, #3b6fa0);
          color: #fff;
          box-shadow: 0 2px 10px rgba(26,39,68,0.2);
        }
        .save-btn.idle:hover { box-shadow: 0 4px 15px rgba(26,39,68,0.3); transform: translateY(-1px); }
        .save-btn.saving { background: #e8e5de; color: #888; cursor: not-allowed; }
        .save-btn.saved { background: #e8f5e9; color: #2e7d32; }
        .save-btn.error { background: #fef2f2; color: #991b1b; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
      `}</style>
    </div>
  );
}

// ─── Save button with state ───
function SaveButton({
  state,
  onClick,
  label,
  disabled = false,
}: {
  state: SaveState;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "saving"}
      className={`save-btn ${state}`}
    >
      {state === "saving" && <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} />}
      {state === "saved" && <Check size={15} />}
      {state === "saving" ? "Sauvegarde…" : state === "saved" ? "Sauvegardé !" : state === "error" ? "⚠ Erreur" : <><Save size={15} /> {label}</>}
    </button>
  );
}
