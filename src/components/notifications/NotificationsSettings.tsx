"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, Phone, MessageSquare, Smartphone, AlertCircle, Loader2, Save, Check, Share, Plus } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

// ═══════════════════════════════════════════════════════════════
// Settings notifications — opt-in stricte par catégorie
//
// Affiche les préférences notif (push + SMS opt-in) et permet à
// l'utilisateur de les modifier. Le SMS est désactivé tant que la
// plateforme n'a pas configuré Twilio (smsAvailable=false).
// ═══════════════════════════════════════════════════════════════

interface Prefs {
  push_enabled: boolean;
  sms_enabled: boolean;
  sms_phone: string | null;
  notify_assignment: boolean;
  notify_urgent_unassigned: boolean;
  notify_comment: boolean;
  notify_closure: boolean;
}

interface Props {
  smsAvailable?: boolean;
}

export default function NotificationsSettings({ smsAvailable: smsAvailableProp }: Props) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [smsAvailable, setSmsAvailable] = useState<boolean>(smsAvailableProp ?? false);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Souscription Web Push (PushManager + permission navigateur)
  const { status: pushStatus, subscribe, unsubscribe } = usePushSubscription();
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setPrefs(data as Prefs);
          if (typeof data.sms_available === "boolean") setSmsAvailable(data.sms_available);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((p) => p ? { ...p, [key]: value } : p);
    setSaved(false);
  }

  function save() {
    if (!prefs) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Erreur");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  if (loading || !prefs) {
    return <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Chargement…</p>;
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 640 }}>
      {/* Push (Web Push : toujours dispo si VAPID configuré) */}
      <div className="civiq-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Bell size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>Notifications mobiles (push)</h3>
            <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2, lineHeight: 1.5 }}>
              Compatible Android (Chrome, Firefox), Windows, macOS et iPhone à condition d&apos;ajouter l&apos;app à l&apos;écran d&apos;accueil.
            </p>
          </div>
        </div>

        {/* État de la souscription navigateur */}
        {pushStatus === "denied" && (
          <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "oklch(0.97 0.04 25)", border: "1px solid var(--destructive)", color: "var(--destructive)", fontSize: 12, display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 12 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Vous avez refusé les notifications dans votre navigateur. Pour les réactiver, allez dans les réglages du site (cadenas dans la barre d&apos;adresse) puis autorisez les notifications.</span>
          </div>
        )}

        {pushStatus === "ios-pwa-required" && (
          <div style={{ padding: "12px 14px", borderRadius: "var(--radius-sm)", background: "var(--accent-light)", color: "var(--accent)", fontSize: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }}>
              <Smartphone size={14} /> Activation sur iPhone
            </div>
            <p style={{ marginBottom: 6, lineHeight: 1.5 }}>
              iOS exige que l&apos;app soit installée sur l&apos;écran d&apos;accueil :
            </p>
            <ol style={{ paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
              <li>Dans Safari, appuyez sur <Share size={11} style={{ verticalAlign: "middle" }} /> Partager</li>
              <li>Puis <Plus size={11} style={{ verticalAlign: "middle" }} /> « Sur l&apos;écran d&apos;accueil »</li>
              <li>Rouvrez GoCiviq depuis l&apos;icône installée et revenez sur cette page</li>
            </ol>
          </div>
        )}

        {pushStatus === "unsupported" && (
          <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "oklch(0.97 0.02 240)", color: "var(--fg-muted)", fontSize: 12, marginBottom: 12 }}>
            Ce navigateur ne supporte pas les notifications push. Utilisez Chrome, Firefox, Edge ou Safari (iOS 16.4+ en PWA installée).
          </div>
        )}

        <PushToggle
          label="Activer les notifications push"
          checked={prefs.push_enabled && pushStatus === "subscribed"}
          status={pushStatus}
          busy={pushBusy}
          onChange={async (v) => {
            setPushBusy(true);
            try {
              if (v) {
                const ok = await subscribe();
                if (ok) {
                  set("push_enabled", true);
                  // Sauvegarde immédiate pour éviter de perdre la pref en cas de
                  // navigation avant le clic sur "Enregistrer"
                  await fetch("/api/notifications/preferences", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...prefs, push_enabled: true }),
                  });
                }
              } else {
                await unsubscribe();
                set("push_enabled", false);
                await fetch("/api/notifications/preferences", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...prefs, push_enabled: false }),
                });
              }
            } finally {
              setPushBusy(false);
            }
          }}
        />
      </div>

      {/* SMS (Twilio) */}
      <div className="civiq-card" style={{ padding: 18, opacity: smsAvailable ? 1 : 0.65 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "oklch(0.95 0.06 155)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MessageSquare size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>Notifications SMS</h3>
            <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2, lineHeight: 1.5 }}>
              Recevez les alertes critiques par SMS. Service à coût marginal — à activer uniquement si nécessaire.
            </p>
            {!smsAvailable && (
              <p style={{ fontSize: 12, color: "var(--warning)", marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
                <AlertCircle size={12} /> Le service SMS n&apos;est pas configuré sur cette plateforme.
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label className="civiq-field-label" style={{ fontSize: 12 }}>Numéro de téléphone</label>
            <div style={{ position: "relative" }}>
              <Phone size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--fg-muted)", pointerEvents: "none" }} />
              <input
                type="tel"
                value={prefs.sms_phone ?? ""}
                onChange={(e) => set("sms_phone", e.target.value)}
                placeholder="+33 6 12 34 56 78"
                disabled={!smsAvailable}
                className="civiq-input"
                style={{ paddingLeft: 32 }}
              />
            </div>
            <p style={{ fontSize: 11, color: "var(--fg-xmuted)", marginTop: 4 }}>
              Format international recommandé (+33…). Numéro français accepté aussi (06…).
            </p>
          </div>

          <Toggle
            label="Activer les SMS"
            checked={prefs.sms_enabled}
            onChange={(v) => set("sms_enabled", v)}
            disabled={!smsAvailable}
          />
        </div>
      </div>

      {/* Catégories à notifier */}
      <div className="civiq-card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>Quand être notifié·e ?</h3>
        <p style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 14 }}>
          S&apos;applique aux deux canaux (push + SMS).
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <Toggle
            label="Un ticket m'est assigné"
            sub="Push immédiat dès qu'un ticket arrive sur mon plateau"
            checked={prefs.notify_assignment}
            onChange={(v) => set("notify_assignment", v)}
          />
          <Toggle
            label="Ticket urgent non assigné"
            sub="Pour les agents techniques : tout signalement urgent en attente"
            checked={prefs.notify_urgent_unassigned}
            onChange={(v) => set("notify_urgent_unassigned", v)}
          />
          <Toggle
            label="Nouveau commentaire"
            sub="Sur un ticket dont je suis assigné·e"
            checked={prefs.notify_comment}
            onChange={(v) => set("notify_comment", v)}
          />
          <Toggle
            label="Clôture de mon ticket"
            sub="Quand un ticket que j'ai signalé est résolu"
            checked={prefs.notify_closure}
            onChange={(v) => set("notify_closure", v)}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "oklch(0.97 0.04 25)", border: "1px solid var(--destructive)", color: "var(--destructive)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="civiq-btn civiq-btn-default"
        >
          {pending ? <Loader2 size={14} className="civiq-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
          {pending ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer mes préférences"}
        </button>
        {saved && (
          <span style={{ fontSize: 12, color: "var(--success)" }}>
            Vos préférences ont été mises à jour.
          </span>
        )}
      </div>
    </div>
  );
}

function PushToggle({ label, checked, status, busy, onChange }: {
  label: string;
  checked: boolean;
  status: ReturnType<typeof usePushSubscription>["status"];
  busy: boolean;
  onChange: (v: boolean) => Promise<void> | void;
}) {
  const disabled = busy || status === "denied" || status === "ios-pwa-required" || status === "unsupported" || status === "loading";
  return (
    <label
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", borderRadius: "var(--radius-sm)",
        background: checked && !disabled ? "var(--accent-light)" : "var(--bg)",
        border: `1px solid ${checked && !disabled ? "var(--accent)" : "var(--border)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          position: "relative", width: 36, height: 20, borderRadius: 99,
          background: checked && !disabled ? "var(--accent)" : "var(--border)",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 3px oklch(0 0 0 / 0.2)",
        }} />
      </span>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{label}</div>
      {busy && <Loader2 size={14} className="civiq-spin" style={{ color: "var(--accent)" }} />}
    </label>
  );
}

function Toggle({ label, sub, checked, onChange, disabled }: {
  label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "10px 12px", borderRadius: "var(--radius-sm)",
        background: checked && !disabled ? "var(--accent-light)" : "var(--bg)",
        border: `1px solid ${checked && !disabled ? "var(--accent)" : "var(--border)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          position: "relative", width: 36, height: 20, borderRadius: 99,
          background: checked && !disabled ? "var(--accent)" : "var(--border)",
          flexShrink: 0, marginTop: 1,
          transition: "background 0.15s",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 3px oklch(0 0 0 / 0.2)",
        }} />
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2, lineHeight: 1.5 }}>{sub}</div>}
      </div>
    </label>
  );
}
