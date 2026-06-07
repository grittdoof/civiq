import Link from "next/link";
import { ArrowLeft, Lock, Mail } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Écran "Permission insuffisante" générique, à afficher quand un
// utilisateur tente d'accéder à une fonctionnalité sans y avoir droit.
//
// Mieux qu'un redirect silencieux : l'utilisateur sait pourquoi
// il est bloqué et qui contacter.
// ═══════════════════════════════════════════════════════════════

interface Props {
  /** Titre principal (par défaut : "Permission insuffisante") */
  title?: string;
  /** Description du contexte (ex : "créer un ticket d'intervention") */
  action: string;
  /** Email du contact / administrateur de la commune (optionnel) */
  contactEmail?: string | null;
  /** Nom de la commune (optionnel, pour le message) */
  communeName?: string | null;
  /** Lien de retour (par défaut : tableau de bord) */
  backHref?: string;
  backLabel?: string;
}

export default function ForbiddenScreen({
  title = "Permission insuffisante",
  action,
  contactEmail,
  communeName,
  backHref = "/admin/dashboard",
  backLabel = "Retour au tableau de bord",
}: Props) {
  return (
    <main className="civiq-main" style={{ maxWidth: 580 }}>
      <div
        className="civiq-card"
        style={{
          padding: "32px 28px",
          textAlign: "center",
          background: "var(--card)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            background: "oklch(0.95 0.05 60)",
            color: "#92400E",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          <Lock size={28} />
        </div>

        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--fg)",
            margin: "0 0 10px",
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--fg-muted)",
            lineHeight: 1.55,
            margin: "0 auto 8px",
            maxWidth: 440,
          }}
        >
          Votre compte ne dispose pas des droits nécessaires pour {action}.
        </p>

        <p
          style={{
            fontSize: 14,
            color: "var(--fg-muted)",
            lineHeight: 1.55,
            margin: "0 auto 20px",
            maxWidth: 440,
          }}
        >
          Contactez l&apos;administrateur
          {communeName ? <> de <strong style={{ color: "var(--fg)" }}>{communeName}</strong></> : null}
          {" "}pour demander l&apos;accès.
        </p>

        {contactEmail && (
          <a
            href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Demande d'accès — ${action}`)}`}
            className="civiq-btn civiq-btn-default"
            style={{
              justifyContent: "center",
              minWidth: 240,
              marginBottom: 12,
            }}
          >
            <Mail size={14} />
            Écrire à l&apos;administrateur
          </a>
        )}

        <div>
          <Link
            href={backHref}
            className="civiq-btn civiq-btn-ghost"
            style={{ justifyContent: "center", marginTop: 4 }}
          >
            <ArrowLeft size={14} />
            {backLabel}
          </Link>
        </div>

        <p
          style={{
            fontSize: 11,
            color: "var(--fg-xmuted)",
            lineHeight: 1.5,
            marginTop: 22,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          Les rôles autorisés pour cette action sont définis par
          l&apos;administrateur de votre commune dans Profil &gt; Utilisateurs.
        </p>
      </div>
    </main>
  );
}
