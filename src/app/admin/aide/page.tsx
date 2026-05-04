import Link from "next/link";
import {
  HelpCircle, FileText, Wrench, Bell, Smartphone, Users,
  Plus, MapPin, Camera, MessageSquare, Sparkles, ChevronRight,
  CheckCircle2, BookOpen,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// /admin/aide — Tutoriel didactique
//
// Guide visuel pour démarrer rapidement. Sections numérotées,
// captures-style cards, conçu pour mobile et desktop.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default function AidePage() {
  return (
    <main className="civiq-main">
      <div className="civiq-page-header">
        <div>
          <h1 className="civiq-page-title">
            <HelpCircle size={22} style={{ verticalAlign: "middle", marginRight: 8, color: "var(--accent)" }} />
            Aide &amp; tutoriel
          </h1>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 3 }}>
            Tout ce qu&apos;il faut savoir pour utiliser GoCiviQ au quotidien.
          </p>
        </div>
      </div>

      {/* Bandeau bienvenue */}
      <div
        className="civiq-card"
        style={{
          padding: 22,
          marginBottom: 26,
          background: "linear-gradient(135deg, var(--accent-light) 0%, oklch(0.96 0.06 200) 100%)",
          borderColor: "var(--accent)",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "var(--radius)",
            background: "var(--accent)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Sparkles size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em", marginBottom: 4 }}>
              Bienvenue sur GoCiviQ !
            </h2>
            <p style={{ fontSize: 14, color: "var(--fg)", lineHeight: 1.55, opacity: 0.85 }}>
              GoCiviQ est la plateforme civique de votre commune. Elle réunit deux modules complémentaires :
              les <strong>sondages citoyens</strong> pour consulter vos administrés, et les <strong>tickets d&apos;intervention</strong> pour piloter
              les signalements terrain. Cette page vous guide pas à pas.
            </p>
          </div>
        </div>
      </div>

      {/* Sommaire */}
      <nav style={{ marginBottom: 26 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 10 }}>
          Sommaire
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          <TocLink href="#prise-en-main" icon={<BookOpen size={14} />} label="1. Prise en main" />
          <TocLink href="#sondages" icon={<FileText size={14} />} label="2. Sondages" />
          <TocLink href="#tickets" icon={<Wrench size={14} />} label="3. Tickets" />
          <TocLink href="#mobile" icon={<Smartphone size={14} />} label="4. Mobile" />
          <TocLink href="#notifications" icon={<Bell size={14} />} label="5. Notifications" />
          <TocLink href="#equipe" icon={<Users size={14} />} label="6. Équipe & rôles" />
        </div>
      </nav>

      {/* 1. Prise en main */}
      <Section id="prise-en-main" number="1" title="Prise en main" icon={<BookOpen size={18} />}>
        <Step title="Découvrez votre tableau de bord">
          <p>
            Le <strong>Tableau de bord</strong> regroupe les chiffres clés de tous vos modules :
            tickets ouverts, sondages actifs, réponses citoyennes. Les tickets prioritaires apparaissent en haut
            pour ne rien manquer.
          </p>
          <Link href="/admin/dashboard" className="civiq-btn civiq-btn-outline civiq-btn-sm" style={{ marginTop: 8 }}>
            Voir mon tableau de bord <ChevronRight size={13} />
          </Link>
        </Step>

        <Step title="Comprenez le menu de gauche">
          <p>La sidebar est organisée en 4 sections :</p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 13.5 }}>
            <li><strong>Tableau de bord</strong> — vue globale, toujours accessible</li>
            <li><strong>Sondages</strong> — vos consultations citoyennes</li>
            <li><strong>Support</strong> — vos tickets d&apos;intervention (terrain)</li>
            <li><strong>Outil</strong> — aide, paramètres, profil</li>
          </ul>
          <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 6 }}>
            Les boutons « + Nouveau… » en pointillés sont des actions rapides — créez en un clic.
          </p>
        </Step>
      </Section>

      {/* 2. Sondages */}
      <Section id="sondages" number="2" title="Module Sondages" icon={<FileText size={18} />}>
        <Step title="Créer un sondage" cta={{ href: "/admin/surveys/new", label: "Créer un sondage" }}>
          <p>
            Cliquez sur <strong>« + Nouveau sondage »</strong> dans la sidebar. Choisissez un modèle
            (périscolaire, vie associative, budget participatif…) ou partez d&apos;une page blanche.
          </p>
        </Step>

        <Step title="Publier et partager">
          <p>
            Une fois votre sondage prêt, passez son statut sur <strong>Publié</strong>. Vous obtenez :
          </p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 13.5 }}>
            <li>Un <strong>lien public</strong> à diffuser par email, SMS, réseaux sociaux</li>
            <li>Un <strong>QR code</strong> téléchargeable pour vos affiches</li>
            <li>Une <strong>URL courte</strong> de la forme <code>/survey/votre-slug</code></li>
          </ul>
        </Step>

        <Step title="Analyser les résultats">
          <p>
            Sur chaque sondage : 4 onglets <strong>Vue d&apos;ensemble</strong>, <strong>Questions</strong>, <strong>Entonnoir</strong>, <strong>Réponses</strong>.
            Exportez en <strong>CSV</strong> ou <strong>Excel</strong> en un clic, ou consultez chaque réponse une par une.
          </p>
        </Step>
      </Section>

      {/* 3. Tickets */}
      <Section id="tickets" number="3" title="Module Tickets d'intervention" icon={<Wrench size={18} />}>
        <Step title="Créer un ticket en 30 secondes" cta={{ href: "/admin/tickets/nouveau", label: "Nouveau ticket" }}>
          <p>
            Idéal en mobilité (élu sur le terrain, agent d&apos;accueil après un appel). Le formulaire enchaîne :
          </p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 13.5 }}>
            <li><Camera size={12} style={{ verticalAlign: "middle" }} /> <strong>Photo</strong> — prise depuis la caméra ou la galerie</li>
            <li><MapPin size={12} style={{ verticalAlign: "middle" }} /> <strong>Localisation</strong> — GPS automatique, recherche d&apos;adresse, ou clic sur la carte</li>
            <li>Quelques mots de description, catégorie, priorité</li>
            <li>(Optionnel) assignation directe à un agent technique</li>
          </ul>
        </Step>

        <Step title="Suivre un ticket">
          <p>
            Cliquez sur un ticket dans la liste pour voir son détail. Le panneau de droite expose
            les <strong>actions contextuelles</strong> selon le statut courant :
          </p>
          <div style={{ display: "grid", gap: 6, fontSize: 13, marginTop: 8 }}>
            <Mini label="Nouveau / Assigné" value="→ Prendre en charge, Annuler" />
            <Mini label="Pris en charge" value="→ Démarrer, Mettre en pause, Résoudre" />
            <Mini label="En cours" value="→ Résolu, Pause" />
            <Mini label="Résolu" value="→ Clôturer définitivement, Réouvrir" />
          </div>
        </Step>

        <Step title="Plusieurs assignés sur un ticket">
          <p>
            Un ticket peut concerner plusieurs agents (ex : voirie + espaces verts).
            Le bouton <strong>« Modifier »</strong> dans la zone Assignés ouvre un dialog
            <em> multi-sélection</em> : cochez tous les agents concernés, validez. Le premier assigné
            reste l&apos;assigné principal.
          </p>
        </Step>

        <Step title="Clôturer avec rapport (mobile-friendly)" cta={{ href: "/admin/tickets", label: "Mes tickets" }}>
          <p>
            En bout d&apos;intervention, le bouton <strong>« Rédiger le rapport et clôturer »</strong> ouvre un wizard 3 étapes :
            photo « service fait », rapport (durée, matériaux, coût), validation. Pensé pour 90 secondes en plein chantier.
          </p>
        </Step>

        <Step title="Tickets ouverts par défaut">
          <p>
            La liste affiche par défaut <strong>les tickets ouverts</strong> (non clos, non annulés).
            Utilisez les pills <em>Nouveaux / En cours / Urgents / Mes tickets / Clos / Tous</em> pour filtrer.
          </p>
        </Step>
      </Section>

      {/* 4. Mobile */}
      <Section id="mobile" number="4" title="Sur mobile" icon={<Smartphone size={18} />}>
        <Step title="Installer GoCiviQ comme une vraie app">
          <p>
            GoCiviQ est une <strong>PWA</strong> : installez-la sur votre écran d&apos;accueil pour un accès en un tap.
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <PlatformCard
              platform="iPhone (Safari)"
              steps={[
                "Touchez le bouton Partager (carré avec flèche)",
                "Faites défiler et choisissez « Sur l'écran d'accueil »",
                "Validez « Ajouter »",
              ]}
            />
            <PlatformCard
              platform="Android (Chrome)"
              steps={[
                "Touchez le menu ⋮ en haut à droite",
                "Choisissez « Ajouter à l'écran d'accueil »",
                "Validez « Installer »",
              ]}
            />
          </div>
          <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 8, lineHeight: 1.5 }}>
            ⚠ Sur iPhone, l&apos;installation à l&apos;écran d&apos;accueil est <strong>obligatoire</strong> pour recevoir les notifications push.
          </p>
        </Step>

        <Step title="Gestes & navigation tactile">
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 13.5 }}>
            <li>Le menu hamburger en haut à gauche ouvre la sidebar complète</li>
            <li>Les cartes ticket / sondage sont entièrement tappables</li>
            <li>Les zones de tap font ≥ 44 px (norme accessibilité)</li>
            <li>Le formulaire de création de ticket a une caméra native intégrée</li>
          </ul>
        </Step>
      </Section>

      {/* 5. Notifications */}
      <Section id="notifications" number="5" title="Notifications" icon={<Bell size={18} />}>
        <Step title="Activer les notifications push" cta={{ href: "/admin/profile", label: "Mes paramètres" }}>
          <p>
            Compatible <strong>Android, Windows, macOS</strong> directement. Sur <strong>iPhone</strong>, installez d&apos;abord
            l&apos;app à l&apos;écran d&apos;accueil (cf. section précédente) puis acceptez la demande de permission au premier
            lancement.
          </p>
          <p style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 6 }}>
            Vous recevrez : assignation, ticket urgent, commentaire, clôture.
          </p>
        </Step>

        <Step title="Notifications SMS (opt-in)">
          <p>
            Pour les agents en zone blanche ou les responsables qui ne consultent pas l&apos;app, GoCiviQ
            peut envoyer des <strong>SMS</strong> via Twilio. C&apos;est <strong>opt-in strict</strong> : chaque
            utilisateur active le service depuis son profil et renseigne son numéro.
          </p>
          <p style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 6 }}>
            Service à coût marginal : la commune ou la plateforme facture les SMS envoyés.
          </p>
        </Step>

        <Step title="Personnaliser les catégories">
          <p>
            Dans <strong>Profil &amp; paramètres → Notifications</strong>, activez ou désactivez chaque type :
            assignation, ticket urgent, commentaire, clôture. S&apos;applique aux deux canaux (push + SMS).
          </p>
        </Step>
      </Section>

      {/* 6. Équipe */}
      <Section id="equipe" number="6" title="Équipe & rôles" icon={<Users size={18} />}>
        <Step title="Comprendre les rôles">
          <div style={{ display: "grid", gap: 8 }}>
            <RoleBadge name="Lecteur (administré)" perms={["Consulter sondages et tickets"]} color="oklch(0.95 0.005 258)" fg="#6B7280" />
            <RoleBadge name="Éditeur" perms={["Modifier les contenus", "Ne peut pas créer ni supprimer"]} color="oklch(0.95 0.05 258)" fg="#3B82F6" />
            <RoleBadge name="Administrateur" perms={["Tout gérer dans la commune", "Créer et supprimer (corbeille)"]} color="oklch(0.95 0.06 155)" fg="var(--success)" />
            <RoleBadge name="Super-administrateur" perms={["Toute la plateforme", "Activer modules par commune", "Suppression définitive"]} color="oklch(0.95 0.07 25)" fg="var(--destructive)" />
          </div>
        </Step>

        <Step title="Inviter ou rattacher un membre">
          <p>
            Demandez à un super-administrateur d&apos;inviter le membre via <em>/super-admin/communes/[votre commune]</em>.
            L&apos;utilisateur recevra un lien magique par email pour activer son compte.
          </p>
        </Step>
      </Section>

      {/* Footer aide */}
      <div className="civiq-card" style={{ padding: 18, textAlign: "center", marginTop: 30 }}>
        <CheckCircle2 size={28} style={{ color: "var(--success)", margin: "0 auto 8px" }} />
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 6 }}>
          Une question, un blocage ?
        </h3>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 12 }}>
          Contactez votre super-administrateur ou écrivez-nous.
        </p>
        <a href="mailto:contact@gociviq.fr" className="civiq-btn civiq-btn-outline civiq-btn-sm">
          <MessageSquare size={13} /> contact@gociviq.fr
        </a>
      </div>
    </main>
  );
}

function TocLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        color: "var(--fg)",
        fontSize: 13, fontWeight: 500,
        textDecoration: "none",
        transition: "all 0.12s",
      }}
    >
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      {label}
    </a>
  );
}

function Section({ id, number, title, icon, children }: {
  id: string; number: string; title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: 36, scrollMarginTop: 80 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--accent)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 14,
          flexShrink: 0,
        }}>
          {number}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.025em", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--accent)" }}>{icon}</span>
          {title}
        </h2>
      </header>
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </section>
  );
}

function Step({ title, children, cta }: {
  title: string;
  children: React.ReactNode;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="civiq-card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 6, letterSpacing: "-0.005em" }}>
        {title}
      </h3>
      <div style={{ fontSize: 13.5, color: "var(--fg)", lineHeight: 1.6 }}>{children}</div>
      {cta && (
        <Link
          href={cta.href}
          className="civiq-btn civiq-btn-outline civiq-btn-sm"
          style={{ marginTop: 10 }}
        >
          {cta.label} <ChevronRight size={13} />
        </Link>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12.5 }}>
      <span style={{ color: "var(--fg-muted)", fontWeight: 600, minWidth: 140 }}>{label}</span>
      <span style={{ color: "var(--fg)" }}>{value}</span>
    </div>
  );
}

function PlatformCard({ platform, steps }: { platform: string; steps: string[] }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
        <Smartphone size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
        {platform}
      </div>
      <ol style={{ paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: "var(--fg)" }}>
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

function RoleBadge({ name, perms, color, fg }: { name: string; perms: string[]; color: string; fg: string }) {
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      padding: "10px 12px",
      background: color, borderRadius: "var(--radius-sm)",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: fg, marginBottom: 4 }}>{name}</div>
        <ul style={{ paddingLeft: 16, fontSize: 12.5, lineHeight: 1.6, color: "var(--fg)" }}>
          {perms.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </div>
    </div>
  );
}
