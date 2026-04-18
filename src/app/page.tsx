import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export default async function HomePage() {
  const supabase = await createClient();

  // Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="civiq-landing">
      {/* Hero */}
      <section className="landing-hero">
        <nav className="landing-nav">
          <div className="landing-logo">
            <span className="logo-icon">🏛</span>
            <span className="logo-text">CiviQ</span>
          </div>
          <div className="landing-nav-links">
            {user ? (
              <Link href="/admin/dashboard" className="nav-btn primary">
                Mon tableau de bord
              </Link>
            ) : (
              <>
                <Link href="/auth/login" className="nav-btn secondary">
                  Connexion
                </Link>
                <Link href="/auth/register" className="nav-btn primary">
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-badge">Plateforme open-source pour collectivités</div>
          <h1>
            Consultez vos administrés,
            <br />
            <em>simplement.</em>
          </h1>
          <p className="hero-desc">
            CiviQ est une plateforme modulaire de sondages civiques conçue pour
            les communes françaises. Créez des consultations citoyennes en
            quelques minutes, analysez les résultats et prenez des décisions
            éclairées.
          </p>
          <div className="hero-actions">
            <Link href="/auth/register" className="hero-btn primary">
              Démarrer gratuitement →
            </Link>
            <Link href="/demo/periscolaire" className="hero-btn secondary">
              Voir la démo
            </Link>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <strong>0 €</strong>
              <span>pour démarrer</span>
            </div>
            <div className="stat-sep" />
            <div className="stat">
              <strong>5 min</strong>
              <span>pour créer un sondage</span>
            </div>
            <div className="stat-sep" />
            <div className="stat">
              <strong>RGPD</strong>
              <span>conforme</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2>Tout ce qu'il faut pour consulter vos citoyens</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📋</div>
            <h3>Sondages modulaires</h3>
            <p>
              Créez des formulaires multi-étapes avec des dizaines de types de
              champs : choix multiples, échelles, grilles, texte libre, champs
              conditionnels…
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3>Branding personnalisé</h3>
            <p>
              Chaque commune dispose de son propre espace avec ses couleurs, son
              logo et son identité visuelle.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Analyse en temps réel</h3>
            <p>
              Tableaux de bord avec graphiques, distributions, tendances. Export
              CSV et JSON en un clic.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Mobile-first</h3>
            <p>
              Interface optimisée pour smartphones. Vos administrés répondent
              depuis n'importe quel appareil.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>RGPD natif</h3>
            <p>
              Données hébergées en Europe, anonymisation des réponses, mentions
              légales intégrées.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📚</div>
            <h3>Bibliothèque de modèles</h3>
            <p>
              Périscolaire, budget participatif, urbanisme, satisfaction…
              Démarrez à partir de modèles éprouvés.
            </p>
          </div>
        </div>
      </section>

      {/* Templates */}
      <section className="landing-templates">
        <h2>Modèles prêts à l'emploi</h2>
        <p className="section-desc">
          Inspirés des meilleures pratiques des pays de l'OCDE en matière de
          démocratie participative locale.
        </p>
        <div className="templates-grid">
          <div className="template-card">
            <div className="template-tag">Disponible</div>
            <h3>🎒 Besoins périscolaires</h3>
            <p>
              Cantine, mercredi, vacances, aide aux devoirs, bénévolat —
              identifiez les besoins des familles.
            </p>
            <ul>
              <li>6 étapes</li>
              <li>~30 questions</li>
              <li>~5 min</li>
            </ul>
          </div>
          <div className="template-card upcoming">
            <div className="template-tag">Bientôt</div>
            <h3>💰 Budget participatif</h3>
            <p>
              Permettez aux citoyens de prioriser les investissements
              municipaux.
            </p>
            <ul>
              <li>Priorisation par classement</li>
              <li>Allocation budgétaire</li>
            </ul>
          </div>
          <div className="template-card upcoming">
            <div className="template-tag">Bientôt</div>
            <h3>🏗 Urbanisme & cadre de vie</h3>
            <p>
              Aménagement, mobilité, espaces verts — recueillez les avis sur les
              projets urbains.
            </p>
            <ul>
              <li>Cartographie interactive</li>
              <li>Photos avant/après</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <h2>Prêt à consulter vos administrés ?</h2>
        <p>
          Inscription gratuite, aucune carte bancaire requise. Votre premier
          sondage en ligne en moins de 10 minutes.
        </p>
        <Link href="/auth/register" className="hero-btn primary">
          Créer mon espace commune →
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="logo-icon">🏛</span> CiviQ
          </div>
          <p>
            Plateforme open-source de sondages civiques.
            <br />
            Conçue pour les communes françaises, déployable partout.
          </p>
          <div className="footer-links">
            <a href="https://github.com/votre-org/civiq" target="_blank">
              GitHub
            </a>
            <a href="/mentions-legales">Mentions légales</a>
            <a href="/confidentialite">Confidentialité</a>
          </div>
        </div>
      </footer>

      <style>{`
        .civiq-landing {
          font-family: 'Source Sans 3', -apple-system, sans-serif;
          color: #2c2c2a;
        }

        /* ─── NAV ─── */
        .landing-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 0;
        }
        .landing-logo { display: flex; align-items: center; gap: 10px; }
        .logo-icon { font-size: 28px; }
        .logo-text { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: #fff; }
        .landing-nav-links { display: flex; gap: 12px; }
        .nav-btn { padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; transition: 0.2s; }
        .nav-btn.secondary { color: #fff; border: 1px solid rgba(255,255,255,0.3); }
        .nav-btn.secondary:hover { background: rgba(255,255,255,0.1); }
        .nav-btn.primary { background: #c9a84c; color: #1a2744; }
        .nav-btn.primary:hover { background: #d4b65f; }

        /* ─── HERO ─── */
        .landing-hero {
          background: linear-gradient(135deg, #1a2744 0%, #243a5e 50%, #3b6fa0 100%);
          color: #fff;
          padding: 0 24px 80px;
          position: relative;
          overflow: hidden;
        }
        .landing-hero::before {
          content: '';
          position: absolute;
          top: -200px;
          right: -100px;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%);
          border-radius: 50%;
        }
        .hero-content { max-width: 800px; margin: 0 auto; position: relative; z-index: 1; padding-top: 40px; }
        .hero-badge {
          display: inline-block;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 40px;
          padding: 6px 18px;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.5px;
          margin-bottom: 28px;
        }
        .hero-content h1 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(36px, 6vw, 56px);
          font-weight: 700;
          line-height: 1.15;
          margin-bottom: 20px;
        }
        .hero-content h1 em { color: #e8d596; font-style: normal; }
        .hero-desc { font-size: 18px; font-weight: 300; line-height: 1.7; opacity: 0.9; max-width: 600px; margin-bottom: 32px; }
        .hero-actions { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 48px; }
        .hero-btn { padding: 16px 32px; border-radius: 10px; font-size: 16px; font-weight: 600; text-decoration: none; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; }
        .hero-btn.primary { background: #c9a84c; color: #1a2744; box-shadow: 0 4px 20px rgba(201,168,76,0.3); }
        .hero-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 6px 25px rgba(201,168,76,0.4); }
        .hero-btn.secondary { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .hero-btn.secondary:hover { background: rgba(255,255,255,0.15); }

        .hero-stats { display: flex; align-items: center; gap: 32px; }
        .stat strong { display: block; font-size: 22px; font-weight: 700; }
        .stat span { font-size: 13px; opacity: 0.7; }
        .stat-sep { width: 1px; height: 40px; background: rgba(255,255,255,0.2); }

        /* ─── FEATURES ─── */
        .landing-features {
          max-width: 1000px;
          margin: 0 auto;
          padding: 80px 24px;
        }
        .landing-features h2 {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 700;
          color: #1a2744;
          text-align: center;
          margin-bottom: 48px;
        }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
        .feature-card {
          background: #fff;
          border-radius: 12px;
          padding: 28px;
          box-shadow: 0 2px 20px rgba(26,39,68,0.06);
          border: 1px solid rgba(0,0,0,0.04);
          transition: 0.2s;
        }
        .feature-card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(26,39,68,0.1); }
        .feature-icon { font-size: 32px; margin-bottom: 16px; }
        .feature-card h3 { font-size: 18px; font-weight: 600; color: #1a2744; margin-bottom: 8px; }
        .feature-card p { font-size: 14px; line-height: 1.6; color: #666; }

        /* ─── TEMPLATES ─── */
        .landing-templates {
          background: #f2efe8;
          padding: 80px 24px;
        }
        .landing-templates h2 {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 700;
          color: #1a2744;
          text-align: center;
          margin-bottom: 12px;
        }
        .section-desc { text-align: center; color: #888; font-size: 16px; margin-bottom: 48px; }
        .templates-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; max-width: 1000px; margin: 0 auto; }
        .template-card {
          background: #fff;
          border-radius: 12px;
          padding: 28px;
          box-shadow: 0 2px 20px rgba(26,39,68,0.06);
          border: 1px solid rgba(0,0,0,0.04);
          position: relative;
        }
        .template-card.upcoming { opacity: 0.65; }
        .template-tag {
          display: inline-block;
          background: #e8f5e9;
          color: #2e7d32;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 20px;
          margin-bottom: 12px;
        }
        .template-card.upcoming .template-tag { background: #fff3e0; color: #e65100; }
        .template-card h3 { font-size: 18px; font-weight: 600; color: #1a2744; margin-bottom: 8px; }
        .template-card p { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 12px; }
        .template-card ul { list-style: none; display: flex; gap: 16px; font-size: 13px; color: #999; }

        /* ─── CTA ─── */
        .landing-cta {
          text-align: center;
          padding: 80px 24px;
          max-width: 600px;
          margin: 0 auto;
        }
        .landing-cta h2 {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 700;
          color: #1a2744;
          margin-bottom: 16px;
        }
        .landing-cta p { font-size: 16px; color: #888; line-height: 1.6; margin-bottom: 32px; }

        /* ─── FOOTER ─── */
        .landing-footer {
          background: #1a2744;
          color: rgba(255,255,255,0.7);
          padding: 48px 24px;
        }
        .footer-inner { max-width: 800px; margin: 0 auto; text-align: center; }
        .footer-brand { font-family: 'Playfair Display', serif; font-size: 20px; color: #fff; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .footer-inner p { font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
        .footer-links { display: flex; justify-content: center; gap: 24px; }
        .footer-links a { color: rgba(255,255,255,0.6); text-decoration: none; font-size: 13px; }
        .footer-links a:hover { color: #c9a84c; }

        @media (max-width: 600px) {
          .hero-stats { flex-direction: column; align-items: flex-start; gap: 16px; }
          .stat-sep { display: none; }
          .landing-nav { padding: 16px 0; }
          .landing-nav-links { gap: 8px; }
        }
      `}</style>
    </main>
  );
}
