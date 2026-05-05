import Link from "next/link";
import {
  ArrowRight, ShieldCheck, Sparkles, Users, MessageSquare, MapPin,
  Wrench, FileText, PiggyBank, CalendarDays, Bell, Building2,
  CheckCircle2, Clock, Lock, Award, Zap, Quote,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Landing GoCiviq — palette République (Marine + Azur + Rouge)
// Conçue comme une page de vente :
//   1. Hero avec promesse forte et CTA démo
//   2. USPs (3 piliers : Modulaire / Fait par un maire / Souverain)
//   3. Modules (live + roadmap)
//   4. Preuve : créé par un maire (citation + commune)
//   5. Comment ça marche (3 étapes)
//   6. Section démo : booking Cal.com / Calendly
//   7. CTA final + footer
// ═══════════════════════════════════════════════════════════════

const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK || "https://cal.com/gociviq/demo-15min";

export default function HomePage() {
  return (
    <main className="lp">
      {/* ─── NAV ─── */}
      <header className="lp-nav">
        <div className="lp-container lp-nav-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-horizontal.svg" alt="GoCiviq" className="lp-logo" />
          <nav className="lp-nav-links">
            <a href="#modules">Modules</a>
            <a href="#preuve">Pourquoi GoCiviq</a>
            <a href="#demo">Démo</a>
            <Link href="/auth/login" className="lp-btn lp-btn-ghost">Connexion</Link>
            <a href="#demo" className="lp-btn lp-btn-primary">
              Demander une démo <ArrowRight size={14} />
            </a>
          </nav>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="lp-hero">
        <div className="lp-container lp-hero-inner">
          <div className="lp-hero-text">
            <span className="lp-eyebrow">
              <ShieldCheck size={13} /> Plateforme citoyenne · Made in France
            </span>
            <h1 className="lp-h1">
              La plateforme modulaire pour les <span className="lp-h1-accent">collectivités engagées</span> dans la participation citoyenne.
            </h1>
            <p className="lp-lead">
              GoCiviq offre des outils utiles aux <strong>agents territoriaux</strong> et aux <strong>conseils municipaux</strong> :
              consultations citoyennes, suivi des interventions terrain, budget participatif. Activez les modules dont vous avez besoin, sans vous équiper d&apos;un usine à gaz.
            </p>
            <div className="lp-hero-cta">
              <a href="#demo" className="lp-btn lp-btn-primary lp-btn-lg">
                Réserver une démo gratuite <ArrowRight size={16} />
              </a>
              <a href="#modules" className="lp-btn lp-btn-outline lp-btn-lg">
                Voir les modules
              </a>
            </div>
            <div className="lp-hero-trust">
              <span className="lp-hero-trust-item"><Award size={13} /> Créée par un maire en exercice</span>
              <span className="lp-hero-trust-item"><Lock size={13} /> Hébergement européen</span>
              <span className="lp-hero-trust-item"><CheckCircle2 size={13} /> RGPD natif</span>
            </div>
          </div>

          <div className="lp-hero-visual" aria-hidden>
            <div className="lp-hero-card lp-hero-card-1">
              <div className="lp-hero-card-icon" style={{ background: "var(--marine)" }}>
                <FileText size={18} color="#fff" />
              </div>
              <div>
                <div className="lp-hero-card-title">Sondage périscolaire</div>
                <div className="lp-hero-card-meta">214 réponses · 87% complétion</div>
              </div>
            </div>
            <div className="lp-hero-card lp-hero-card-2">
              <div className="lp-hero-card-icon" style={{ background: "var(--rouge)" }}>
                <Wrench size={18} color="#fff" />
              </div>
              <div>
                <div className="lp-hero-card-title">Nid-de-poule rue de la Mairie</div>
                <div className="lp-hero-card-meta">🚨 Urgent · Marc D. assigné</div>
              </div>
            </div>
            <div className="lp-hero-card lp-hero-card-3">
              <div className="lp-hero-card-icon" style={{ background: "var(--azur)" }}>
                <PiggyBank size={18} color="#fff" />
              </div>
              <div>
                <div className="lp-hero-card-title">Budget participatif 2026</div>
                <div className="lp-hero-card-meta">12 projets · 3 245 votes</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── USPs ─── */}
      <section className="lp-section lp-section-light">
        <div className="lp-container">
          <div className="lp-grid-3">
            <USP
              icon={<Sparkles size={20} />}
              title="Modulaire — payez ce que vous utilisez"
              text="Activez les modules à la carte : sondages, tickets, budget participatif. Vous gardez la main, vous évoluez quand vous voulez."
            />
            <USP
              icon={<Award size={20} />}
              title="Créée par un maire, pour les communes"
              text="Pensée par un élu en exercice qui en avait assez de bricoler avec Excel et WhatsApp. Tous les modules viennent d'un besoin réel sur le terrain."
              featured
            />
            <USP
              icon={<ShieldCheck size={20} />}
              title="Souveraine et conforme"
              text="Hébergement Europe, RGPD intégré dès la conception, accessibilité AA. Vos données et celles de vos administrés restent en France."
            />
          </div>
        </div>
      </section>

      {/* ─── MODULES ─── */}
      <section id="modules" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-eyebrow lp-eyebrow-light">
              <Zap size={13} /> Une plateforme, plusieurs cas d&apos;usage
            </span>
            <h2 className="lp-h2">Des modules conçus pour les besoins du terrain</h2>
            <p className="lp-section-lead">
              Démarrez avec un module, ajoutez les autres au fil de l&apos;eau. Tout est intégré : un seul compte, une seule interface, une seule formation.
            </p>
          </div>

          <div className="lp-modules">
            <ModuleCard
              icon={<FileText size={22} />}
              status="live"
              name="Sondages citoyens"
              description="Consultations multi-étapes, templates métier (périscolaire, vie associative, budget participatif), QR code, export Excel, statistiques en temps réel."
              features={["Templates prêts à l'emploi", "QR code de partage", "Analyse par étape", "Export CSV / Excel"]}
            />
            <ModuleCard
              icon={<Wrench size={22} />}
              status="live"
              name="Tickets d'intervention"
              description="Pour les services techniques. Signalement en 30 secondes depuis le mobile, géolocalisation, photo, multi-assignation, rapport de service fait."
              features={["Géolocalisation auto", "Multi-assignés", "Notifications push & SMS", "Rapport d'intervention"]}
            />
            <ModuleCard
              icon={<PiggyBank size={22} />}
              status="beta"
              name="Budget participatif"
              description="Lancez vos projets citoyens : dépôt d'idées par les habitants, vote en ligne sécurisé, suivi de réalisation."
              features={["Dépôt d'idées", "Vote sécurisé", "Suivi de réalisation"]}
            />
            <ModuleCard
              icon={<CalendarDays size={22} />}
              status="soon"
              name="Événements municipaux"
              description="Inscriptions à la fête du village, vœux, vide-greniers… avec contrôle de la jauge et liste de présence."
              features={["Inscriptions en ligne", "Contrôle de jauge", "Liste émargement"]}
            />
            <ModuleCard
              icon={<Bell size={22} />}
              status="soon"
              name="Alertes citoyennes"
              description="Diffusez en quelques secondes une info importante (tempête, coupure d'eau) à tous les habitants abonnés."
              features={["SMS + push", "Ciblage par quartier", "Historique consultable"]}
            />
            <ModuleCard
              icon={<Building2 size={22} />}
              status="soon"
              name="Urbanisme & cadre de vie"
              description="Consultations PLU, projets d'aménagement, mobilier urbain. Carte interactive et commentaires géolocalisés."
              features={["Carte interactive", "Commentaires géolocalisés", "Consultation PLU"]}
            />
          </div>
        </div>
      </section>

      {/* ─── PREUVE / FOUNDER ─── */}
      <section id="preuve" className="lp-section lp-section-marine">
        <div className="lp-container">
          <div className="lp-founder">
            <div className="lp-founder-quote">
              <Quote size={36} className="lp-quote-mark" />
              <p className="lp-quote-text">
                « Quand je suis devenu maire d&apos;une commune de 1 200 habitants, je passais mes soirées à compiler
                des sondages papier dans des tableurs et à courir derrière les agents techniques pour savoir
                où en était tel signalement. J&apos;ai créé GoCiviq pour <strong>arrêter de perdre du temps</strong> et me concentrer sur
                ce qui compte : <strong>l&apos;échange avec les habitants et l&apos;action concrète</strong>. »
              </p>
              <div className="lp-quote-author">
                <div className="lp-quote-author-name">Aurélien Giorgino</div>
                <div className="lp-quote-author-title">Maire de Châteauneuf · Fondateur de GoCiviq</div>
              </div>
            </div>
            <div className="lp-founder-stats">
              <Stat value="100%" label="Code & données en France" />
              <Stat value="6 modules" label="Plateforme évolutive" />
              <Stat value="-15 h/sem" label="Gain de temps moyen estimé" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMMENT ÇA MARCHE ─── */}
      <section className="lp-section lp-section-light">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-eyebrow lp-eyebrow-light">
              <Clock size={13} /> En 3 étapes
            </span>
            <h2 className="lp-h2">Vous êtes en service en moins d&apos;une heure</h2>
          </div>

          <div className="lp-grid-3 lp-steps">
            <StepCard
              number="1"
              title="Démo gratuite, sans engagement"
              text="Un appel vidéo de 15 minutes pour comprendre vos besoins et vous montrer la plateforme en action. Réservez le créneau qui vous arrange."
            />
            <StepCard
              number="2"
              title="Activation de votre commune"
              text="Création de votre espace, paramétrage de la charte graphique de votre mairie, import de vos contacts. Nous nous occupons de tout."
            />
            <StepCard
              number="3"
              title="Formation et lancement"
              text="Une session avec vos agents et élus, livraison d'un tutoriel adapté à vos rôles. Votre première consultation peut partir le jour même."
            />
          </div>
        </div>
      </section>

      {/* ─── DÉMO BOOKING ─── */}
      <section id="demo" className="lp-section">
        <div className="lp-container">
          <div className="lp-demo-grid">
            <div>
              <span className="lp-eyebrow lp-eyebrow-light">
                <CalendarDays size={13} /> Démo gratuite · 15 minutes
              </span>
              <h2 className="lp-h2">Réservez votre créneau directement dans mon agenda</h2>
              <p className="lp-section-lead" style={{ textAlign: "left", marginTop: 14 }}>
                Choisissez le créneau qui vous arrange — l&apos;invitation arrive dans votre Outlook ou Google Calendar.
                On répond à toutes vos questions, on regarde vos cas d&apos;usage, et vous repartez avec un plan d&apos;action.
              </p>
              <ul className="lp-demo-list">
                <li><CheckCircle2 size={16} /> 15 min · 100% à distance · sans engagement</li>
                <li><CheckCircle2 size={16} /> Réponse aux questions techniques et budgétaires</li>
                <li><CheckCircle2 size={16} /> Démonstration sur vos cas concrets</li>
                <li><CheckCircle2 size={16} /> Devis sous 48 h si vous le souhaitez</li>
              </ul>
              <a href={CAL_LINK} target="_blank" rel="noreferrer" className="lp-btn lp-btn-primary lp-btn-lg" style={{ marginTop: 18 }}>
                Ouvrir le calendrier <ArrowRight size={16} />
              </a>
            </div>

            <div className="lp-demo-card">
              <div className="lp-demo-card-head">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/logo-vertical.svg" alt="" style={{ height: 56, width: "auto" }} />
                <div>
                  <div className="lp-demo-card-title">Démo GoCiviq</div>
                  <div className="lp-demo-card-sub">15 min · Visioconférence</div>
                </div>
              </div>
              <ul className="lp-demo-card-list">
                <li><Users size={14} /> 1 ou 2 participants côté commune</li>
                <li><MessageSquare size={14} /> Présentation interactive</li>
                <li><MapPin size={14} /> Adapté à votre territoire</li>
              </ul>
              <a href={CAL_LINK} target="_blank" rel="noreferrer" className="lp-btn lp-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                Réserver maintenant <ArrowRight size={14} />
              </a>
              <p className="lp-demo-card-note">
                Votre choix s&apos;ajoute à mon Outlook & Google Calendar — vous recevez l&apos;invitation immédiatement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="lp-section lp-section-azur">
        <div className="lp-container lp-cta-final">
          <h2 className="lp-h2 lp-cta-final-title">Prêt à donner la parole à vos administrés ?</h2>
          <p className="lp-section-lead">
            Démarrez gratuitement avec le module Sondages, ajoutez les autres au fil des besoins.
          </p>
          <div className="lp-hero-cta" style={{ justifyContent: "center", marginTop: 18 }}>
            <a href="#demo" className="lp-btn lp-btn-primary lp-btn-lg lp-btn-on-azur">
              Demander ma démo <ArrowRight size={16} />
            </a>
            <Link href="/auth/register" className="lp-btn lp-btn-ghost-on-azur lp-btn-lg">
              Créer un compte
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-horizontal.svg" alt="GoCiviq" style={{ height: 26, width: "auto" }} />
            <p style={{ fontSize: 12, color: "var(--gris-txt)", marginTop: 8, maxWidth: 320 }}>
              Plateforme citoyenne pour les collectivités engagées. Hébergement Europe, conformité RGPD.
            </p>
          </div>
          <div className="lp-footer-cols">
            <div className="lp-footer-col">
              <h4>Produit</h4>
              <a href="#modules">Modules</a>
              <a href="#demo">Réserver une démo</a>
              <Link href="/auth/login">Connexion</Link>
              <Link href="/auth/register">Créer un compte</Link>
            </div>
            <div className="lp-footer-col">
              <h4>Légal</h4>
              <Link href="/mentions-legales">Mentions légales</Link>
              <Link href="/confidentialite">Confidentialité</Link>
            </div>
            <div className="lp-footer-col">
              <h4>Contact</h4>
              <a href="mailto:contact@gociviq.fr">contact@gociviq.fr</a>
            </div>
          </div>
        </div>
        <div className="lp-footer-bar">
          <div className="lp-container" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span>© {new Date().getFullYear()} GoCiviq</span>
            <span>Fait en France 🇫🇷 par un maire pour les communes</span>
          </div>
        </div>
      </footer>

      <LandingStyles />
    </main>
  );
}

function USP({ icon, title, text, featured }: { icon: React.ReactNode; title: string; text: string; featured?: boolean }) {
  return (
    <div className={`lp-usp ${featured ? "lp-usp-featured" : ""}`}>
      <div className="lp-usp-icon">{icon}</div>
      <h3 className="lp-usp-title">{title}</h3>
      <p className="lp-usp-text">{text}</p>
    </div>
  );
}

function ModuleCard({
  icon, status, name, description, features,
}: { icon: React.ReactNode; status: "live" | "beta" | "soon"; name: string; description: string; features: string[] }) {
  const statusLabel = status === "live" ? "Disponible" : status === "beta" ? "Beta" : "Bientôt";
  const statusBg =
    status === "live" ? "var(--marine)" :
    status === "beta" ? "var(--azur)" :
    "var(--gris-txt)";
  return (
    <div className="lp-module">
      <div className="lp-module-head">
        <div className="lp-module-icon">{icon}</div>
        <span className="lp-module-status" style={{ background: statusBg }}>{statusLabel}</span>
      </div>
      <h3 className="lp-module-name">{name}</h3>
      <p className="lp-module-desc">{description}</p>
      <ul className="lp-module-features">
        {features.map((f) => (
          <li key={f}><CheckCircle2 size={13} /> {f}</li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="lp-stat">
      <div className="lp-stat-value">{value}</div>
      <div className="lp-stat-label">{label}</div>
    </div>
  );
}

function StepCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="lp-step">
      <div className="lp-step-number">{number}</div>
      <h3 className="lp-step-title">{title}</h3>
      <p className="lp-step-text">{text}</p>
    </div>
  );
}

function LandingStyles() {
  return (
    <style>{`
      .lp { background: #fff; color: #0A0E1A; min-height: 100vh; font-family: 'Montserrat', -apple-system, sans-serif; }
      .lp-container { max-width: 1180px; margin: 0 auto; padding: 0 24px; }

      /* NAV */
      .lp-nav { position: sticky; top: 0; background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(8px); z-index: 50; border-bottom: 1px solid #E8EAF1; }
      .lp-nav-inner { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; }
      .lp-logo { height: 30px; width: auto; }
      .lp-nav-links { display: flex; align-items: center; gap: 22px; font-size: 14px; font-weight: 500; }
      .lp-nav-links a { color: var(--gris-soft); text-decoration: none; transition: color 0.15s; }
      .lp-nav-links a:hover { color: var(--marine); }
      .lp-nav-links .lp-btn { font-size: 14px; }
      @media (max-width: 720px) {
        .lp-nav-links a:not(.lp-btn) { display: none; }
      }

      /* BUTTONS */
      .lp-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 8px; font-weight: 600; text-decoration: none; cursor: pointer; transition: all 0.15s; border: none; font-family: inherit; font-size: 14px; line-height: 1; white-space: nowrap; }
      .lp-btn-lg { padding: 14px 26px; font-size: 15px; border-radius: 10px; }
      .lp-btn-primary { background: var(--marine); color: #fff; box-shadow: 0 1px 3px rgba(4, 47, 100, 0.2); }
      .lp-btn-primary:hover { background: var(--bleu-profond); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(4, 47, 100, 0.3); }
      .lp-btn-outline { background: transparent; color: var(--marine); border: 1.5px solid var(--marine); }
      .lp-btn-outline:hover { background: var(--marine); color: #fff; }
      .lp-btn-ghost { background: transparent; color: var(--marine); }
      .lp-btn-ghost:hover { background: var(--gris-bg); }
      .lp-btn-on-azur { background: #fff; color: var(--marine); }
      .lp-btn-on-azur:hover { background: var(--gris-bg); color: var(--marine); }
      .lp-btn-ghost-on-azur { background: transparent; color: #fff; border: 1.5px solid rgba(255, 255, 255, 0.5); }
      .lp-btn-ghost-on-azur:hover { background: rgba(255, 255, 255, 0.1); border-color: #fff; }

      /* HERO */
      .lp-hero {
        position: relative;
        background:
          radial-gradient(circle at 80% -10%, rgba(47, 111, 219, 0.12), transparent 50%),
          radial-gradient(circle at 0% 100%, rgba(224, 1, 20, 0.06), transparent 40%),
          linear-gradient(180deg, #fff 0%, var(--gris-bg) 100%);
        padding: 80px 0 100px;
        overflow: hidden;
      }
      .lp-hero-inner { display: grid; grid-template-columns: 1.1fr 1fr; gap: 56px; align-items: center; }
      @media (max-width: 980px) { .lp-hero-inner { grid-template-columns: 1fr; } .lp-hero-visual { order: -1; max-width: 480px; margin: 0 auto; } }

      .lp-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 12px; background: rgba(47, 111, 219, 0.1);
        color: var(--azur); font-weight: 600; font-size: 12px;
        letter-spacing: 0.04em; text-transform: uppercase;
        border-radius: 99px; margin-bottom: 18px;
      }
      .lp-eyebrow-light { background: rgba(47, 111, 219, 0.1); color: var(--azur); }

      .lp-h1 {
        font-size: clamp(34px, 5vw, 54px);
        font-weight: 800;
        line-height: 1.08;
        letter-spacing: -0.025em;
        color: var(--marine);
        margin-bottom: 22px;
      }
      .lp-h1-accent { color: var(--azur); }

      .lp-lead { font-size: 17px; color: var(--gris-soft); line-height: 1.6; max-width: 540px; margin-bottom: 28px; }

      .lp-hero-cta { display: flex; gap: 12px; flex-wrap: wrap; }
      .lp-hero-trust { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 26px; font-size: 13px; color: var(--gris-soft); }
      .lp-hero-trust-item { display: inline-flex; align-items: center; gap: 5px; }
      .lp-hero-trust-item svg { color: var(--azur); }

      .lp-hero-visual {
        position: relative;
        height: 480px;
      }
      .lp-hero-card {
        position: absolute;
        background: #fff;
        border: 1px solid #E8EAF1;
        border-radius: 16px;
        box-shadow: 0 12px 32px rgba(4, 47, 100, 0.12);
        padding: 16px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: lp-float 6s ease-in-out infinite;
      }
      .lp-hero-card-1 { top: 30px; left: 0; right: 80px; animation-delay: 0s; }
      .lp-hero-card-2 { top: 200px; left: 60px; right: 0; animation-delay: 1.5s; z-index: 2; }
      .lp-hero-card-3 { top: 350px; left: 20px; right: 60px; animation-delay: 3s; }
      @keyframes lp-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      .lp-hero-card-icon {
        width: 40px; height: 40px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .lp-hero-card-title { font-size: 14px; font-weight: 700; color: var(--marine); }
      .lp-hero-card-meta { font-size: 12px; color: var(--gris-txt); margin-top: 2px; }

      /* SECTIONS */
      .lp-section { padding: 90px 0; }
      .lp-section-light { background: var(--gris-bg); }
      .lp-section-marine { background: var(--marine); color: #fff; }
      .lp-section-azur { background: linear-gradient(135deg, var(--azur) 0%, var(--marine) 100%); color: #fff; }

      .lp-section-header { text-align: center; max-width: 720px; margin: 0 auto 48px; }
      .lp-h2 {
        font-size: clamp(28px, 3.6vw, 40px);
        font-weight: 800;
        letter-spacing: -0.02em;
        color: inherit;
        line-height: 1.15;
        margin-bottom: 14px;
      }
      .lp-section-marine .lp-h2, .lp-section-azur .lp-h2 { color: #fff; }
      .lp-section-lead { font-size: 16px; color: var(--gris-soft); line-height: 1.6; max-width: 600px; margin: 0 auto; }
      .lp-section-marine .lp-section-lead, .lp-section-azur .lp-section-lead { color: rgba(255, 255, 255, 0.8); }

      .lp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
      @media (max-width: 880px) { .lp-grid-3 { grid-template-columns: 1fr; } }

      /* USPs */
      .lp-usp { background: #fff; border: 1px solid #E8EAF1; border-radius: 14px; padding: 28px; }
      .lp-usp-featured { border-color: var(--azur); box-shadow: 0 8px 24px rgba(47, 111, 219, 0.12); }
      .lp-usp-icon {
        width: 44px; height: 44px; border-radius: 12px;
        background: rgba(47, 111, 219, 0.1); color: var(--azur);
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 14px;
      }
      .lp-usp-featured .lp-usp-icon { background: var(--azur); color: #fff; }
      .lp-usp-title { font-size: 17px; font-weight: 700; color: var(--marine); margin-bottom: 8px; line-height: 1.3; }
      .lp-usp-text { font-size: 14.5px; color: var(--gris-soft); line-height: 1.6; }

      /* MODULES */
      .lp-modules {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
        gap: 22px;
      }
      .lp-module {
        background: #fff; border: 1px solid #E8EAF1;
        border-radius: 14px; padding: 24px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .lp-module:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(4, 47, 100, 0.08); }
      .lp-module-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
      .lp-module-icon {
        width: 48px; height: 48px; border-radius: 12px;
        background: var(--gris-bg); color: var(--marine);
        display: flex; align-items: center; justify-content: center;
      }
      .lp-module-status {
        font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
        text-transform: uppercase; color: #fff;
        padding: 4px 10px; border-radius: 99px;
      }
      .lp-module-name { font-size: 18px; font-weight: 700; color: var(--marine); margin-bottom: 8px; letter-spacing: -0.01em; }
      .lp-module-desc { font-size: 14px; color: var(--gris-soft); line-height: 1.55; margin-bottom: 14px; }
      .lp-module-features { list-style: none; padding: 0; display: grid; gap: 5px; }
      .lp-module-features li { font-size: 13px; color: var(--marine); display: flex; align-items: center; gap: 6px; }
      .lp-module-features svg { color: var(--azur); flex-shrink: 0; }

      /* FOUNDER */
      .lp-founder { display: grid; grid-template-columns: 1.4fr 1fr; gap: 56px; align-items: center; }
      @media (max-width: 880px) { .lp-founder { grid-template-columns: 1fr; gap: 32px; } }
      .lp-founder-quote { position: relative; }
      .lp-quote-mark { color: rgba(255, 255, 255, 0.18); position: absolute; top: -10px; left: -10px; }
      .lp-quote-text { font-size: 19px; line-height: 1.55; color: rgba(255, 255, 255, 0.94); margin-bottom: 22px; font-weight: 400; position: relative; z-index: 1; }
      .lp-quote-text strong { color: #fff; font-weight: 600; }
      .lp-quote-author-name { font-size: 16px; font-weight: 700; color: #fff; }
      .lp-quote-author-title { font-size: 13px; color: rgba(255, 255, 255, 0.7); margin-top: 2px; }
      .lp-founder-stats { display: grid; gap: 18px; }
      .lp-stat { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 18px 20px; }
      .lp-stat-value { font-size: 28px; font-weight: 800; color: #fff; line-height: 1; letter-spacing: -0.02em; }
      .lp-stat-label { font-size: 13px; color: rgba(255, 255, 255, 0.7); margin-top: 6px; }

      /* STEPS */
      .lp-steps { gap: 22px; }
      .lp-step { background: #fff; border: 1px solid #E8EAF1; border-radius: 14px; padding: 28px; }
      .lp-step-number {
        display: inline-flex; align-items: center; justify-content: center;
        width: 36px; height: 36px; border-radius: 50%;
        background: var(--marine); color: #fff;
        font-weight: 800; font-size: 16px;
        margin-bottom: 14px;
      }
      .lp-step-title { font-size: 17px; font-weight: 700; color: var(--marine); margin-bottom: 8px; }
      .lp-step-text { font-size: 14px; color: var(--gris-soft); line-height: 1.6; }

      /* DEMO */
      .lp-demo-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 56px; align-items: center; }
      @media (max-width: 880px) { .lp-demo-grid { grid-template-columns: 1fr; gap: 28px; } }
      .lp-demo-list { list-style: none; padding: 0; display: grid; gap: 10px; margin-top: 18px; }
      .lp-demo-list li { font-size: 14.5px; color: var(--marine); display: flex; align-items: center; gap: 8px; }
      .lp-demo-list svg { color: var(--azur); flex-shrink: 0; }

      .lp-demo-card {
        background: #fff; border: 1px solid #E8EAF1;
        border-radius: 18px; padding: 26px;
        box-shadow: 0 12px 36px rgba(4, 47, 100, 0.1);
      }
      .lp-demo-card-head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid var(--gris-bg); }
      .lp-demo-card-title { font-size: 17px; font-weight: 700; color: var(--marine); }
      .lp-demo-card-sub { font-size: 12.5px; color: var(--gris-txt); margin-top: 2px; }
      .lp-demo-card-list { list-style: none; padding: 0; display: grid; gap: 8px; margin-bottom: 18px; }
      .lp-demo-card-list li { font-size: 13.5px; color: var(--gris-soft); display: flex; align-items: center; gap: 8px; }
      .lp-demo-card-list svg { color: var(--azur); }
      .lp-demo-card-note { font-size: 11.5px; color: var(--gris-txt); margin-top: 10px; line-height: 1.5; text-align: center; }

      /* CTA FINAL */
      .lp-cta-final { text-align: center; max-width: 720px; margin: 0 auto; }
      .lp-cta-final-title { color: #fff !important; }

      /* FOOTER */
      .lp-footer { background: #0A0E1A; color: rgba(255, 255, 255, 0.7); padding: 56px 0 0; }
      .lp-footer-inner { display: grid; grid-template-columns: 1.3fr 2fr; gap: 48px; padding-bottom: 40px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
      @media (max-width: 720px) { .lp-footer-inner { grid-template-columns: 1fr; gap: 32px; } }
      .lp-footer-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
      @media (max-width: 540px) { .lp-footer-cols { grid-template-columns: repeat(2, 1fr); } }
      .lp-footer-col h4 { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
      .lp-footer-col a { display: block; color: rgba(255, 255, 255, 0.6); text-decoration: none; font-size: 13.5px; margin-bottom: 8px; transition: color 0.15s; }
      .lp-footer-col a:hover { color: #fff; }
      .lp-footer-bar { padding: 22px 0; font-size: 12px; color: rgba(255, 255, 255, 0.5); }
    `}</style>
  );
}
