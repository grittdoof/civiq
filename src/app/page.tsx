"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowRight, ShieldCheck, Sparkles, Users, MessageSquare, MapPin,
  Wrench, FileText, PiggyBank, CalendarDays, Bell, Building2,
  CheckCircle2, Clock, Lock, Award, Zap, Quote, HeartHandshake,
  Lightbulb, TrendingUp, Mail, FileCheck, AlertTriangle, Menu, X,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Landing GoCiviq — Charte République (Marine + Azur + Rouge)
//
// Narration orientée conversion B2G :
//   1.  Hero — promesse directe : « Réduisez le temps de gestion… »
//   2.  Problème — ce que vivent les communes aujourd'hui
//   3.  Solution — comment GoCiviq résout le problème (3 piliers)
//   4.  Modules — bénéfices + cas d'usage par module
//   5.  Cas d'usage concrets — 6 scénarios terrain
//   6.  Pourquoi GoCiviq — 6 raisons institutionnelles
//   7.  Preuve sociale — citation maire + chiffres
//   8.  Comment ça marche — 3 étapes
//   9.  Démo : booking calendrier
//   10. CTA final + footer
// ═══════════════════════════════════════════════════════════════

const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK || "https://cal.com/gociviq/demo-15min";

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  function close() { setMenuOpen(false); }

  // Réduit la navbar (et le logo) après ~40px de scroll vertical
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="lp">
      {/* ═══ NAV ═══ */}
      <header className={`lp-nav${scrolled ? " lp-nav-scrolled" : ""}`}>
        <div className="lp-container lp-nav-inner">
          {/* Logo : horizontal en desktop, coq seul en mobile */}
          <a href="#" className="lp-logo-link" aria-label="GoCiviq">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-horizontal.svg" alt="GoCiviq" className="lp-logo lp-logo-desktop" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/coq-couleur.svg" alt="GoCiviq" className="lp-logo lp-logo-mobile" />
          </a>

          <nav className="lp-nav-links">
            <a href="#modules">Modules</a>
            <a href="#cas-usage">Cas d&apos;usage</a>
            <a href="#pourquoi">Pourquoi GoCiviq</a>
            <Link href="/auth/login" className="lp-btn lp-btn-ghost">Connexion</Link>
            <a href="#demo" className="lp-btn lp-btn-primary">
              Réserver une démo <ArrowRight size={14} />
            </a>
          </nav>

          {/* Hamburger mobile */}
          <button
            type="button"
            className="lp-hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Drawer mobile */}
      {menuOpen && (
        <div className="lp-drawer-overlay" onClick={close}>
          <div className="lp-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="lp-drawer-head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-horizontal.svg" alt="GoCiviq" style={{ height: 28 }} />
              <button type="button" onClick={close} className="lp-drawer-close" aria-label="Fermer">
                <X size={22} />
              </button>
            </div>
            <nav className="lp-drawer-nav">
              <a href="#modules" onClick={close}>Modules</a>
              <a href="#cas-usage" onClick={close}>Cas d&apos;usage</a>
              <a href="#pourquoi" onClick={close}>Pourquoi GoCiviq</a>
              <a href="#demo" onClick={close}>Réserver une démo</a>
              <div className="lp-drawer-footer">
                <Link href="/auth/login" className="lp-btn lp-btn-outline lp-btn-lg" style={{ width: "100%", justifyContent: "center" }} onClick={close}>
                  Connexion
                </Link>
                <a href="#demo" className="lp-btn lp-btn-primary lp-btn-lg" style={{ width: "100%", justifyContent: "center" }} onClick={close}>
                  Réserver une démo <ArrowRight size={16} />
                </a>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* ═══ 1. HERO ═══ */}
      <section className="lp-hero">
        <div className="lp-container lp-hero-inner">
          <div className="lp-hero-text">
            <span className="lp-eyebrow">
              <ShieldCheck size={13} /> Plateforme citoyenne · Souveraine · 🇫🇷
            </span>
            <h1 className="lp-h1">
              Réduisez le temps de gestion et <span className="lp-h1-accent">modernisez la relation</span> entre votre collectivité et vos administrés.
            </h1>
            <p className="lp-lead">
              GoCiviq est la plateforme tout-en-un qui simplifie le quotidien des agents,
              fluidifie la participation citoyenne et redonne du temps aux élus.
              Activez les modules dont vous avez besoin, sans complexité technique.
            </p>
            <div className="lp-hero-cta">
              <a href="#demo" className="lp-btn lp-btn-primary lp-btn-lg">
                Réserver une démo gratuite <ArrowRight size={16} />
              </a>
              <a href="#modules" className="lp-btn lp-btn-outline lp-btn-lg">
                Découvrir la plateforme
              </a>
            </div>
            <div className="lp-hero-trust">
              <span className="lp-hero-trust-item"><Award size={13} /> Conçue par un maire</span>
              <span className="lp-hero-trust-item"><Lock size={13} /> Hébergement Europe</span>
              <span className="lp-hero-trust-item"><CheckCircle2 size={13} /> 100% RGPD</span>
              <span className="lp-hero-trust-item"><Clock size={13} /> Prête en 1 h</span>
            </div>
          </div>

          <div className="lp-hero-visual" aria-hidden>
            <div className="lp-hero-card lp-hero-card-1">
              <div className="lp-hero-card-icon" style={{ background: "var(--marine)" }}>
                <FileText size={18} color="#fff" />
              </div>
              <div>
                <div className="lp-hero-card-title">Sondage périscolaire 2026</div>
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

      {/* ═══ 2. PROBLÈME ═══ */}
      <section className="lp-section lp-section-light">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-eyebrow lp-eyebrow-light">Le constat</span>
            <h2 className="lp-h2">Trop d&apos;outils. Pas assez de temps. Pas assez d&apos;échange.</h2>
            <p className="lp-section-lead">
              Les communes empilent les solutions : tableurs, formulaires papier, groupes WhatsApp, emails.
              Résultat : les agents perdent des heures, les élus n&apos;ont pas de visibilité,
              et les habitants se sentent peu écoutés.
            </p>
          </div>

          <div className="lp-grid-3">
            <PainCard
              icon={<Clock size={20} />}
              title="Des heures perdues chaque semaine"
              text="Saisies en double, recopies de mails, suivi manuel des signalements. Le temps des agents s'évapore."
            />
            <PainCard
              icon={<MessageSquare size={20} />}
              title="Une participation citoyenne qui s'essouffle"
              text="Sans outil simple, organiser une consultation devient un projet en soi. Les habitants décrochent."
            />
            <PainCard
              icon={<AlertTriangle size={20} />}
              title="Aucune vue d'ensemble"
              text="Les élus n'ont pas de tableau de bord. Impossible de prioriser, mesurer, ou rendre des comptes facilement."
            />
          </div>
        </div>
      </section>

      {/* ═══ 3. SOLUTION ═══ */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-eyebrow lp-eyebrow-light"><Sparkles size={13} /> La solution</span>
            <h2 className="lp-h2">Une seule plateforme, des bénéfices immédiats</h2>
            <p className="lp-section-lead">
              GoCiviq centralise consultations, signalements et participation citoyenne.
              Vos équipes gagnent du temps. Vos administrés se sentent entendus. Vos élus pilotent enfin avec des données claires.
            </p>
          </div>

          <div className="lp-grid-3">
            <BenefitCard
              icon={<Zap size={20} />}
              title="Gain de temps réel"
              text="Tâches automatisées, notifications intelligentes, exports en un clic. Vos agents se concentrent sur l'essentiel."
            />
            <BenefitCard
              icon={<HeartHandshake size={20} />}
              title="Lien renforcé avec les habitants"
              text="Consultations ouvertes, transparence des projets, retours mesurés. Vos administrés deviennent acteurs."
              featured
            />
            <BenefitCard
              icon={<TrendingUp size={20} />}
              title="Décisions éclairées"
              text="Tableaux de bord en temps réel, statistiques exploitables. Vos élus voient, mesurent, agissent."
            />
          </div>
        </div>
      </section>

      {/* ═══ 4. MODULES ═══ */}
      <section id="modules" className="lp-section lp-section-light">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-eyebrow lp-eyebrow-light"><Building2 size={13} /> Plateforme modulaire</span>
            <h2 className="lp-h2">Activez uniquement ce dont vous avez besoin</h2>
            <p className="lp-section-lead">
              6 modules conçus pour résoudre un besoin terrain précis. Démarrez avec un, ajoutez les autres au fil de l&apos;eau.
            </p>
          </div>

          <div className="lp-modules">
            <ModuleCard
              icon={<FileText size={22} />}
              status="live"
              name="Sondages citoyens"
              problem="Recueillir l'avis des habitants prend des semaines, le dépouillement est laborieux."
              benefit="Lancez une consultation en 5 minutes, analysez les résultats en temps réel."
              examples={[
                "Besoins périscolaires (rentrée, vacances)",
                "Concertation avant un projet d'aménagement",
                "Évaluation des services municipaux",
              ]}
            />
            <ModuleCard
              icon={<Wrench size={22} />}
              status="live"
              name="Tickets d'intervention"
              problem="Les signalements arrivent par téléphone, email, courrier. Personne ne sait qui fait quoi."
              benefit="Un point d'entrée unique. Géolocalisation, photo, multi-assignation, rapport."
              examples={[
                "Nid-de-poule signalé par un riverain",
                "Lampadaire en panne rue de l'Église",
                "Branche dangereuse au parc",
              ]}
            />
            <ModuleCard
              icon={<PiggyBank size={22} />}
              status="beta"
              name="Budget participatif"
              problem="Organiser un budget participatif demande une plateforme dédiée et chère."
              benefit="Dépôt d'idées, vote sécurisé, suivi de réalisation. Tout intégré, sans surcoût."
              examples={[
                "Aménagement d'une aire de jeux",
                "Création d'un jardin partagé",
                "Rénovation d'un mobilier urbain",
              ]}
            />
            <ModuleCard
              icon={<Building2 size={22} />}
              status="soon"
              name="Concertation urbanisme & PLU"
              problem="Les réunions publiques ne touchent qu'une minorité. La concertation reste superficielle."
              benefit="Carte interactive, commentaires géolocalisés, consultation PLU en ligne, ouverte 24/7."
              examples={[
                "Révision du PLU",
                "Plan de mobilité douce",
                "Réaménagement du centre-bourg",
              ]}
            />
            <ModuleCard
              icon={<Bell size={22} />}
              status="soon"
              name="Alertes citoyennes"
              problem="Une coupure d'eau ou un orage : vous appelez les habitants un par un ?"
              benefit="Diffusez une alerte par SMS et notification push en quelques secondes, par quartier."
              examples={[
                "Tempête, vigilance météo",
                "Coupure d'eau ou de courant",
                "Travaux de voirie programmés",
              ]}
            />
            <ModuleCard
              icon={<Lightbulb size={22} />}
              status="soon"
              name="Boîte à idées citoyenne"
              problem="Les bonnes idées des habitants se perdent dans les boîtes mails."
              benefit="Un espace clair où chacun propose, vote et suit l'évolution de ses idées."
              examples={[
                "Suggestions d'amélioration des services",
                "Idées d'animations municipales",
                "Propositions environnementales",
              ]}
            />
          </div>

          {/* CTA mid-page */}
          <div className="lp-mid-cta">
            <a href="#demo" className="lp-btn lp-btn-primary lp-btn-lg">
              Voir la démo en 15 minutes <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* ═══ 5. CAS D'USAGE ═══ */}
      <section id="cas-usage" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-eyebrow lp-eyebrow-light"><MapPin size={13} /> Sur le terrain</span>
            <h2 className="lp-h2">Des usages concrets pour votre commune</h2>
            <p className="lp-section-lead">
              Comment GoCiviq s&apos;intègre dans le quotidien d&apos;une commune française.
            </p>
          </div>

          <div className="lp-usecases">
            <UseCase
              icon={<MessageSquare size={20} />}
              title="Consulter avant un projet d'aménagement"
              text="Avant de réaménager la place du marché, sondez les commerçants et habitants en 48 h. Décidez sur des données, pas des supputations."
            />
            <UseCase
              icon={<PiggyBank size={20} />}
              title="Organiser un budget participatif"
              text="Allouez 5% du budget d'investissement aux projets choisis par vos habitants. Tout le processus géré en ligne, du dépôt au vote."
            />
            <UseCase
              icon={<Lightbulb size={20} />}
              title="Recueillir les idées des citoyens"
              text="Une boîte à idées toujours ouverte. Les meilleures propositions remontent grâce au vote, et vous communiquez sur les suites données."
            />
            <UseCase
              icon={<Bell size={20} />}
              title="Diffuser des alertes locales"
              text="Tempête, fermeture d'école, coupure d'eau : touchez en quelques secondes les habitants concernés, sans passer par les réseaux sociaux."
            />
            <UseCase
              icon={<FileCheck size={20} />}
              title="Suivre les demandes des administrés"
              text="Toutes les demandes (téléphone, email, contact direct) centralisées. Personne ne tombe entre les mailles du filet."
            />
            <UseCase
              icon={<TrendingUp size={20} />}
              title="Renforcer la transparence municipale"
              text="Publiez les résultats des consultations, les projets en cours, les réalisations. La confiance se construit avec les preuves."
            />
          </div>
        </div>
      </section>

      {/* ═══ 6. POURQUOI GOCIVIQ ═══ */}
      <section id="pourquoi" className="lp-section lp-section-light">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-eyebrow lp-eyebrow-light"><ShieldCheck size={13} /> Pourquoi GoCiviq</span>
            <h2 className="lp-h2">La plateforme pensée pour les collectivités, pas contre elles</h2>
          </div>

          <div className="lp-pourquoi-grid">
            <ReasonCard
              icon={<Sparkles size={20} />}
              title="100% modulaire"
              text="Activez ce dont vous avez besoin. Pas de package gonflé que vous n'utilisez pas."
            />
            <ReasonCard
              icon={<Clock size={20} />}
              title="Mise en route en moins d'une heure"
              text="Création de votre espace, paramétrage, première consultation : tout peut sortir le jour même."
            />
            <ReasonCard
              icon={<Users size={20} />}
              title="Simple pour les agents"
              text="Pas de formation longue. Interface intuitive pensée pour les usages terrain, pas pour les data scientists."
            />
            <ReasonCard
              icon={<HeartHandshake size={20} />}
              title="Relation modernisée avec les administrés"
              text="Vos habitants accèdent à la plateforme par lien ou QR code, sans inscription forcée."
            />
            <ReasonCard
              icon={<Building2 size={20} />}
              title="Adaptée aux petites et moyennes communes"
              text="Pas besoin d'une DSI. Tarification accessible, hébergement géré, support inclus."
            />
            <ReasonCard
              icon={<HeartHandshake size={20} />}
              title="Accompagnement humain"
              text="Une équipe française qui connaît les enjeux des collectivités. On répond rapidement, on écoute, on adapte."
            />
          </div>
        </div>
      </section>

      {/* ═══ 7. PREUVE SOCIALE / FOUNDER ═══ */}
      <section className="lp-section lp-section-marine">
        <div className="lp-container">
          <div className="lp-founder">
            <div className="lp-founder-quote">
              <Quote size={36} className="lp-quote-mark" />
              <p className="lp-quote-text">
                « Devenu maire d&apos;une commune de 1 200 habitants, je passais mes soirées à compiler des sondages
                papier dans des tableurs et à courir après les agents pour savoir où en était tel signalement.
                J&apos;ai créé GoCiviq pour <strong>arrêter de perdre du temps</strong> et me concentrer sur ce qui compte :
                <strong> l&apos;échange avec les habitants et l&apos;action concrète</strong>. »
              </p>
              <div className="lp-quote-author">
                <div className="lp-quote-author-name">Aurélien Giorgino</div>
                <div className="lp-quote-author-title">Maire de Châteauneuf · Fondateur de GoCiviq</div>
              </div>
            </div>
            <div className="lp-founder-stats">
              <Stat value="100%" label="Personnalisable" />
              <Stat value="6" label="Modules activables" />
              <Stat value="< 1 h" label="Mise en route" />
              <Stat value="-15 h/sem" label="Gain de temps estimé" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 8. COMMENT ÇA MARCHE ═══ */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-eyebrow lp-eyebrow-light"><Clock size={13} /> En 3 étapes</span>
            <h2 className="lp-h2">De la démo au lancement en moins d&apos;une semaine</h2>
          </div>

          <div className="lp-grid-3 lp-steps">
            <StepCard
              number="1"
              title="Démo personnalisée (15 min)"
              text="Un appel vidéo court pour comprendre vos besoins et voir la plateforme en action. Sans engagement."
            />
            <StepCard
              number="2"
              title="Activation en 24 h"
              text="Création de votre espace, paramétrage à votre charte, import de vos contacts. On gère, vous validez."
            />
            <StepCard
              number="3"
              title="Formation et lancement"
              text="Une session avec vos agents et élus. Tutoriel adapté à chaque rôle. Votre première consultation peut partir le jour même."
            />
          </div>
        </div>
      </section>

      {/* ═══ 9. DÉMO BOOKING ═══ */}
      <section id="demo" className="lp-section lp-section-light">
        <div className="lp-container">
          <div className="lp-demo-grid">
            <div>
              <span className="lp-eyebrow lp-eyebrow-light">
                <CalendarDays size={13} /> Démo gratuite · 15 minutes · Sans engagement
              </span>
              <h2 className="lp-h2">Réservez votre démo directement dans mon agenda</h2>
              <p className="lp-section-lead" style={{ textAlign: "left", marginTop: 14 }}>
                Choisissez le créneau qui vous arrange. L&apos;invitation est synchronisée avec votre Outlook ou votre Google Agenda en quelques secondes.
              </p>
              <ul className="lp-demo-list">
                <li><CheckCircle2 size={16} /> 15 min · 100% à distance · sans engagement</li>
                <li><CheckCircle2 size={16} /> Présentation adaptée à votre commune</li>
                <li><CheckCircle2 size={16} /> Réponses à vos questions techniques et budgétaires</li>
                <li><CheckCircle2 size={16} /> Devis sous 48 h si vous le souhaitez</li>
              </ul>
              <a href={CAL_LINK} target="_blank" rel="noreferrer" className="lp-btn lp-btn-primary lp-btn-lg" style={{ marginTop: 20 }}>
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
                Synchronisé Outlook & Google Agenda. Confirmation immédiate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 10. CTA FINAL ═══ */}
      <section className="lp-section lp-section-azur">
        <div className="lp-container lp-cta-final">
          <h2 className="lp-h2 lp-cta-final-title">
            Prêt à moderniser la participation citoyenne dans votre commune&nbsp;?
          </h2>
          <p className="lp-section-lead">
            Rejoignez les communes qui ont fait le choix de la simplicité, de la transparence et du gain de temps.
          </p>
          <div className="lp-hero-cta" style={{ justifyContent: "center", marginTop: 20 }}>
            <a href="#demo" className="lp-btn lp-btn-primary lp-btn-lg lp-btn-on-azur">
              Réserver une démo <ArrowRight size={16} />
            </a>
            <a href="#modules" className="lp-btn lp-btn-ghost-on-azur lp-btn-lg">
              Découvrir les modules
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-horizontal-blanc.svg" alt="GoCiviq" style={{ height: 28, width: "auto" }} />
            <p style={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.6)", marginTop: 10, maxWidth: 320, lineHeight: 1.55 }}>
              Plateforme citoyenne souveraine pour les collectivités françaises.
              Hébergée en Europe, conforme RGPD, conçue par et pour les élus.
            </p>
          </div>
          <div className="lp-footer-cols">
            <div className="lp-footer-col">
              <h4>Produit</h4>
              <a href="#modules">Modules</a>
              <a href="#cas-usage">Cas d&apos;usage</a>
              <a href="#pourquoi">Pourquoi GoCiviq</a>
              <a href="#demo">Réserver une démo</a>
            </div>
            <div className="lp-footer-col">
              <h4>Compte</h4>
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
              <a href="mailto:contact@gociviq.fr"><Mail size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />contact@gociviq.fr</a>
            </div>
          </div>
        </div>
        <div className="lp-footer-bar">
          <div className="lp-container" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span>© {new Date().getFullYear()} GoCiviq · Tous droits réservés</span>
            <span>Fait en France 🇫🇷 · Par un maire, pour les communes</span>
          </div>
        </div>
      </footer>

      <LandingStyles />
    </main>
  );
}

// ─── Components ──────────────────────────────────────────────

function PainCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="lp-pain">
      <div className="lp-pain-icon">{icon}</div>
      <h3 className="lp-pain-title">{title}</h3>
      <p className="lp-pain-text">{text}</p>
    </div>
  );
}

function BenefitCard({ icon, title, text, featured }: { icon: React.ReactNode; title: string; text: string; featured?: boolean }) {
  return (
    <div className={`lp-usp ${featured ? "lp-usp-featured" : ""}`}>
      <div className="lp-usp-icon">{icon}</div>
      <h3 className="lp-usp-title">{title}</h3>
      <p className="lp-usp-text">{text}</p>
    </div>
  );
}

function ModuleCard({
  icon, status, name, problem, benefit, examples,
}: {
  icon: React.ReactNode; status: "live" | "beta" | "soon";
  name: string; problem: string; benefit: string; examples: string[];
}) {
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
      <p className="lp-module-problem">
        <span className="lp-module-label">Le problème ·</span> {problem}
      </p>
      <p className="lp-module-benefit">
        <span className="lp-module-label lp-module-label-azur">La réponse ·</span> {benefit}
      </p>
      <div className="lp-module-examples-label">Exemples d&apos;usage</div>
      <ul className="lp-module-features">
        {examples.map((f) => (
          <li key={f}><CheckCircle2 size={13} /> {f}</li>
        ))}
      </ul>
    </div>
  );
}

function UseCase({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="lp-usecase">
      <div className="lp-usecase-icon">{icon}</div>
      <div>
        <h3 className="lp-usecase-title">{title}</h3>
        <p className="lp-usecase-text">{text}</p>
      </div>
    </div>
  );
}

function ReasonCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="lp-reason">
      <div className="lp-reason-icon">{icon}</div>
      <h3 className="lp-reason-title">{title}</h3>
      <p className="lp-reason-text">{text}</p>
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
      .lp-nav {
        position: sticky; top: 0;
        background: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(8px);
        z-index: 50;
        border-bottom: 1px solid transparent;
        transition: border-color 0.25s, box-shadow 0.25s;
      }
      .lp-nav-scrolled {
        background: rgba(255, 255, 255, 0.98);
        border-bottom-color: #E8EAF1;
        box-shadow: 0 4px 14px rgba(4, 47, 100, 0.05);
      }
      .lp-nav-inner {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 24px;
        gap: 12px;
        transition: padding 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .lp-nav-scrolled .lp-nav-inner { padding: 8px 24px; }
      .lp-logo-link { display: inline-flex; align-items: center; line-height: 0; }
      .lp-logo {
        height: 90px; width: auto;
        transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .lp-nav-scrolled .lp-logo { height: 50px; }
      .lp-logo-mobile { display: none; }
      .lp-nav-links { display: flex; align-items: center; gap: 22px; font-size: 14px; font-weight: 500; }
      .lp-nav-links a { color: var(--gris-soft); text-decoration: none; transition: color 0.15s; }
      .lp-nav-links a:hover { color: var(--marine); }
      /* Spécificité — corrige texte gris hérité sur les CTA dans la nav */
      .lp-nav-links .lp-btn { font-size: 14px; }
      .lp-nav-links .lp-btn-primary { color: #fff; }
      .lp-nav-links .lp-btn-primary:hover { color: #fff; }
      .lp-nav-links .lp-btn-ghost { color: var(--marine); }
      .lp-nav-links .lp-btn-ghost:hover { color: var(--marine); }
      .lp-nav-links .lp-btn-outline { color: var(--marine); }

      /* Hamburger (mobile only) */
      .lp-hamburger {
        display: none;
        background: transparent;
        border: 1px solid #E8EAF1;
        border-radius: 10px;
        padding: 8px;
        color: var(--marine);
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }
      .lp-hamburger:hover { background: var(--gris-bg); border-color: #c8d0de; }

      @media (max-width: 880px) {
        .lp-logo-desktop { display: none; }
        .lp-logo-mobile  { display: block; height: 56px; }
        .lp-nav-scrolled .lp-logo-mobile { height: 38px; }
        .lp-nav-links { display: none; }
        .lp-hamburger { display: inline-flex; align-items: center; justify-content: center; }
      }

      /* Drawer mobile */
      .lp-drawer-overlay {
        position: fixed; inset: 0;
        background: rgba(10, 14, 26, 0.5);
        backdrop-filter: blur(4px);
        z-index: 100;
        animation: lp-fade 0.2s ease-out;
      }
      .lp-drawer {
        position: fixed; top: 0; right: 0; bottom: 0;
        width: min(320px, 88vw);
        background: #fff;
        box-shadow: -16px 0 40px rgba(4, 47, 100, 0.18);
        display: flex; flex-direction: column;
        animation: lp-slide-right 0.22s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .lp-drawer-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 18px 20px; border-bottom: 1px solid #E8EAF1;
      }
      .lp-drawer-close {
        background: transparent; border: none; cursor: pointer;
        padding: 8px; border-radius: 8px; color: var(--gris-soft);
      }
      .lp-drawer-close:hover { background: var(--gris-bg); color: var(--marine); }
      .lp-drawer-nav {
        flex: 1; display: flex; flex-direction: column;
        padding: 12px 16px;
      }
      .lp-drawer-nav > a {
        padding: 14px 12px;
        color: var(--marine);
        text-decoration: none;
        font-size: 16px; font-weight: 600;
        border-bottom: 1px solid #F2F3F7;
        transition: color 0.15s;
      }
      .lp-drawer-nav > a:hover { color: var(--azur); }
      .lp-drawer-footer {
        margin-top: auto; padding: 16px 0 8px;
        display: flex; flex-direction: column; gap: 10px;
      }
      @keyframes lp-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes lp-slide-right { from { transform: translateX(100%); } to { transform: translateX(0); } }

      /* BUTTONS */
      .lp-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 11px 20px; border-radius: 10px;
        font-weight: 600; text-decoration: none; cursor: pointer;
        transition: all 0.18s; border: none; font-family: inherit;
        font-size: 14px; line-height: 1; white-space: nowrap;
      }
      .lp-btn-lg { padding: 15px 28px; font-size: 15.5px; border-radius: 12px; }
      .lp-btn-primary {
        background: var(--marine); color: #fff;
        box-shadow: 0 2px 4px rgba(4, 47, 100, 0.18), 0 4px 14px rgba(4, 47, 100, 0.18);
      }
      .lp-btn-primary:hover {
        background: var(--bleu-profond); transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(4, 47, 100, 0.32);
      }
      .lp-btn-outline { background: transparent; color: var(--marine); border: 1.5px solid var(--marine); }
      .lp-btn-outline:hover { background: var(--marine); color: #fff; }
      .lp-btn-ghost { background: transparent; color: var(--marine); }
      .lp-btn-ghost:hover { background: var(--gris-bg); }
      .lp-btn-on-azur { background: #fff; color: var(--marine); }
      .lp-btn-on-azur:hover { background: var(--gris-bg); transform: translateY(-1px); }
      .lp-btn-ghost-on-azur { background: transparent; color: #fff; border: 1.5px solid rgba(255, 255, 255, 0.5); }
      .lp-btn-ghost-on-azur:hover { background: rgba(255, 255, 255, 0.12); border-color: #fff; }

      /* HERO */
      .lp-hero {
        position: relative;
        background:
          radial-gradient(circle at 80% -10%, rgba(47, 111, 219, 0.14), transparent 50%),
          radial-gradient(circle at 0% 100%, rgba(224, 1, 20, 0.05), transparent 40%),
          linear-gradient(180deg, #fff 0%, var(--gris-bg) 100%);
        padding: 80px 0 100px;
        overflow: hidden;
      }
      .lp-hero-inner { display: grid; grid-template-columns: 1.1fr 1fr; gap: 56px; align-items: center; }
      @media (max-width: 980px) {
        .lp-hero-inner { grid-template-columns: 1fr; }
        .lp-hero-visual { display: none; }
      }

      .lp-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 12px;
        background: rgba(47, 111, 219, 0.1);
        color: var(--azur); font-weight: 600; font-size: 12px;
        letter-spacing: 0.04em; text-transform: uppercase;
        border-radius: 99px; margin-bottom: 20px;
      }
      .lp-eyebrow-light { background: rgba(47, 111, 219, 0.1); color: var(--azur); }

      .lp-h1 {
        font-size: clamp(34px, 5.4vw, 56px);
        font-weight: 800;
        line-height: 1.05;
        letter-spacing: -0.025em;
        color: var(--marine);
        margin-bottom: 22px;
      }
      .lp-h1-accent { color: var(--azur); }

      .lp-lead { font-size: 18px; color: var(--gris-soft); line-height: 1.6; max-width: 560px; margin-bottom: 30px; }

      .lp-hero-cta { display: flex; gap: 12px; flex-wrap: wrap; }
      .lp-hero-trust { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 28px; font-size: 13px; color: var(--gris-soft); }
      .lp-hero-trust-item { display: inline-flex; align-items: center; gap: 5px; }
      .lp-hero-trust-item svg { color: var(--azur); }

      .lp-hero-visual { position: relative; height: 480px; }
      .lp-hero-card {
        position: absolute; background: #fff;
        border: 1px solid #E8EAF1; border-radius: 16px;
        box-shadow: 0 12px 32px rgba(4, 47, 100, 0.12);
        padding: 16px 18px; display: flex; align-items: center; gap: 12px;
        animation: lp-float 6s ease-in-out infinite;
      }
      .lp-hero-card-1 { top: 30px; left: 0; right: 80px; animation-delay: 0s; }
      .lp-hero-card-2 { top: 200px; left: 60px; right: 0; animation-delay: 1.5s; z-index: 2; }
      .lp-hero-card-3 { top: 350px; left: 20px; right: 60px; animation-delay: 3s; }
      @keyframes lp-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      .lp-hero-card-icon {
        width: 40px; height: 40px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .lp-hero-card-title { font-size: 14px; font-weight: 700; color: var(--marine); }
      .lp-hero-card-meta { font-size: 12px; color: var(--gris-txt); margin-top: 2px; }

      /* SECTIONS */
      .lp-section { padding: 90px 0; }
      .lp-section-light { background: var(--gris-bg); }
      /* Section marine masquée selon demande client */
      .lp-section-marine { display: none; }
      .lp-section-azur { background: linear-gradient(135deg, var(--azur) 0%, var(--marine) 100%); color: #fff; }

      .lp-section-header { text-align: center; max-width: 760px; margin: 0 auto 56px; }
      .lp-h2 {
        font-size: clamp(28px, 3.8vw, 42px);
        font-weight: 800; letter-spacing: -0.022em;
        color: var(--marine); line-height: 1.15; margin-bottom: 16px;
      }
      .lp-section-marine .lp-h2, .lp-section-azur .lp-h2 { color: #fff; }
      .lp-section-lead { font-size: 17px; color: var(--gris-soft); line-height: 1.6; max-width: 640px; margin: 0 auto; }
      .lp-section-marine .lp-section-lead, .lp-section-azur .lp-section-lead { color: rgba(255, 255, 255, 0.85); }

      .lp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
      @media (max-width: 880px) { .lp-grid-3 { grid-template-columns: 1fr; } }

      /* PAIN CARDS */
      .lp-pain { background: #fff; border: 1px solid #E8EAF1; border-radius: 14px; padding: 26px; }
      .lp-pain-icon {
        width: 44px; height: 44px; border-radius: 12px;
        background: rgba(224, 1, 20, 0.08); color: var(--rouge);
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 14px;
      }
      .lp-pain-title { font-size: 16.5px; font-weight: 700; color: var(--marine); margin-bottom: 8px; line-height: 1.3; }
      .lp-pain-text { font-size: 14px; color: var(--gris-soft); line-height: 1.6; }

      /* USP / BENEFIT */
      .lp-usp { background: #fff; border: 1px solid #E8EAF1; border-radius: 14px; padding: 28px; }
      .lp-usp-featured { border-color: var(--azur); box-shadow: 0 8px 28px rgba(47, 111, 219, 0.14); transform: translateY(-2px); }
      .lp-usp-icon {
        width: 46px; height: 46px; border-radius: 12px;
        background: rgba(47, 111, 219, 0.1); color: var(--azur);
        display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
      }
      .lp-usp-featured .lp-usp-icon { background: var(--azur); color: #fff; }
      .lp-usp-title { font-size: 18px; font-weight: 700; color: var(--marine); margin-bottom: 8px; line-height: 1.3; }
      .lp-usp-text { font-size: 14.5px; color: var(--gris-soft); line-height: 1.6; }

      /* MODULES */
      .lp-modules {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 22px;
        margin-bottom: 36px;
      }
      .lp-module {
        background: #fff; border: 1px solid #E8EAF1;
        border-radius: 14px; padding: 26px;
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex; flex-direction: column;
      }
      .lp-module:hover { transform: translateY(-3px); box-shadow: 0 16px 36px rgba(4, 47, 100, 0.1); }
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
      .lp-module-name { font-size: 19px; font-weight: 700; color: var(--marine); margin-bottom: 12px; letter-spacing: -0.01em; }
      .lp-module-problem, .lp-module-benefit {
        font-size: 13.5px; color: var(--gris-soft); line-height: 1.55; margin-bottom: 10px;
      }
      .lp-module-label {
        font-weight: 700; color: var(--rouge); text-transform: uppercase;
        font-size: 10.5px; letter-spacing: 0.06em; margin-right: 4px;
      }
      .lp-module-label-azur { color: var(--azur); }
      .lp-module-examples-label {
        font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.07em; color: var(--gris-txt);
        margin: 14px 0 8px; padding-top: 14px; border-top: 1px solid #E8EAF1;
      }
      .lp-module-features { list-style: none; padding: 0; display: grid; gap: 5px; margin-top: auto; }
      .lp-module-features li { font-size: 13px; color: var(--marine); display: flex; align-items: center; gap: 6px; }
      .lp-module-features svg { color: var(--azur); flex-shrink: 0; }

      .lp-mid-cta { text-align: center; margin-top: 12px; }

      /* USECASES */
      .lp-usecases { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 22px; }
      .lp-usecase {
        background: #fff; border: 1px solid #E8EAF1;
        border-radius: 14px; padding: 24px;
        display: flex; gap: 14px; align-items: flex-start;
        transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
      }
      .lp-usecase:hover { border-color: var(--azur); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(47, 111, 219, 0.08); }
      .lp-usecase-icon {
        width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
        background: rgba(47, 111, 219, 0.1); color: var(--azur);
        display: flex; align-items: center; justify-content: center;
      }
      .lp-usecase-title { font-size: 16px; font-weight: 700; color: var(--marine); margin-bottom: 6px; line-height: 1.3; }
      .lp-usecase-text { font-size: 14px; color: var(--gris-soft); line-height: 1.6; }

      /* POURQUOI */
      .lp-pourquoi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
      .lp-reason {
        background: #fff; border: 1px solid #E8EAF1;
        border-radius: 14px; padding: 22px;
      }
      .lp-reason-icon {
        width: 40px; height: 40px; border-radius: 10px;
        background: var(--marine); color: #fff;
        display: flex; align-items: center; justify-content: center; margin-bottom: 12px;
      }
      .lp-reason-title { font-size: 15.5px; font-weight: 700; color: var(--marine); margin-bottom: 6px; line-height: 1.3; }
      .lp-reason-text { font-size: 13.5px; color: var(--gris-soft); line-height: 1.6; }

      /* FOUNDER */
      .lp-founder { display: grid; grid-template-columns: 1.4fr 1fr; gap: 56px; align-items: center; }
      @media (max-width: 880px) { .lp-founder { grid-template-columns: 1fr; gap: 32px; } }
      .lp-founder-quote { position: relative; }
      .lp-quote-mark { color: rgba(255, 255, 255, 0.18); position: absolute; top: -10px; left: -10px; }
      .lp-quote-text { font-size: 19px; line-height: 1.55; color: rgba(255, 255, 255, 0.94); margin-bottom: 22px; font-weight: 400; position: relative; z-index: 1; }
      .lp-quote-text strong { color: #fff; font-weight: 600; }
      .lp-quote-author-name { font-size: 16px; font-weight: 700; color: #fff; }
      .lp-quote-author-title { font-size: 13px; color: rgba(255, 255, 255, 0.7); margin-top: 2px; }
      .lp-founder-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .lp-stat { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 16px 18px; }
      .lp-stat-value { font-size: 26px; font-weight: 800; color: #fff; line-height: 1; letter-spacing: -0.02em; }
      .lp-stat-label { font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-top: 6px; }

      /* STEPS */
      .lp-steps { gap: 22px; }
      .lp-step { background: #fff; border: 1px solid #E8EAF1; border-radius: 14px; padding: 28px; position: relative; }
      .lp-step-number {
        display: inline-flex; align-items: center; justify-content: center;
        width: 38px; height: 38px; border-radius: 50%;
        background: var(--marine); color: #fff;
        font-weight: 800; font-size: 16px; margin-bottom: 14px;
      }
      .lp-step-title { font-size: 17px; font-weight: 700; color: var(--marine); margin-bottom: 8px; }
      .lp-step-text { font-size: 14px; color: var(--gris-soft); line-height: 1.6; }

      /* DEMO */
      .lp-demo-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 56px; align-items: center; }
      @media (max-width: 880px) { .lp-demo-grid { grid-template-columns: 1fr; gap: 28px; } }
      .lp-demo-list { list-style: none; padding: 0; display: grid; gap: 10px; margin-top: 18px; }
      .lp-demo-list li { font-size: 14.5px; color: var(--marine); display: flex; align-items: center; gap: 8px; font-weight: 500; }
      .lp-demo-list svg { color: var(--azur); flex-shrink: 0; }

      .lp-demo-card {
        background: #fff; border: 1px solid #E8EAF1;
        border-radius: 18px; padding: 28px;
        box-shadow: 0 16px 40px rgba(4, 47, 100, 0.12);
      }
      .lp-demo-card-head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid var(--gris-bg); }
      .lp-demo-card-title { font-size: 17px; font-weight: 700; color: var(--marine); }
      .lp-demo-card-sub { font-size: 12.5px; color: var(--gris-txt); margin-top: 2px; }
      .lp-demo-card-list { list-style: none; padding: 0; display: grid; gap: 8px; margin-bottom: 18px; }
      .lp-demo-card-list li { font-size: 13.5px; color: var(--gris-soft); display: flex; align-items: center; gap: 8px; }
      .lp-demo-card-list svg { color: var(--azur); }
      .lp-demo-card-note { font-size: 11.5px; color: var(--gris-txt); margin-top: 10px; line-height: 1.5; text-align: center; }

      /* CTA FINAL */
      .lp-cta-final { text-align: center; max-width: 760px; margin: 0 auto; }
      .lp-cta-final-title { color: #fff !important; }

      /* FOOTER */
      .lp-footer { background: #0A0E1A; color: rgba(255, 255, 255, 0.7); padding: 56px 0 0; }
      .lp-footer-inner { display: grid; grid-template-columns: 1.3fr 2.4fr; gap: 48px; padding-bottom: 40px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
      @media (max-width: 880px) { .lp-footer-inner { grid-template-columns: 1fr; gap: 32px; } }
      .lp-footer-cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
      @media (max-width: 720px) { .lp-footer-cols { grid-template-columns: repeat(2, 1fr); } }
      .lp-footer-col h4 { font-size: 12.5px; font-weight: 700; color: #fff; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
      .lp-footer-col a { display: block; color: rgba(255, 255, 255, 0.6); text-decoration: none; font-size: 13.5px; margin-bottom: 8px; transition: color 0.15s; }
      .lp-footer-col a:hover { color: #fff; }
      .lp-footer-bar { padding: 22px 0; font-size: 12px; color: rgba(255, 255, 255, 0.5); }

      /* RESPONSIVE TWEAKS */
      @media (max-width: 720px) {
        .lp-section { padding: 60px 0; }
        .lp-hero { padding: 60px 0 80px; }
        .lp-hero-trust { gap: 14px; }
        .lp-section-header { margin-bottom: 36px; }
      }
    `}</style>
  );
}
