import Link from "next/link";

// ═══════════════════════════════════════════════════
// MENTIONS LÉGALES — Page statique obligatoire
// ═══════════════════════════════════════════════════

export const metadata = {
  title: "Mentions légales — CiviQ",
  description: "Mentions légales de la plateforme CiviQ",
};

export default function MentionsLegalesPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link href="/" className="legal-back">
          ← Retour à l'accueil
        </Link>

        <h1>Mentions légales</h1>
        <p className="legal-date">Dernière mise à jour : avril 2026</p>

        <section>
          <h2>1. Éditeur de la plateforme</h2>
          <p>
            La plateforme <strong>CiviQ</strong> est éditée par une entité privée proposant
            des services numériques aux collectivités territoriales françaises.
          </p>
          <p>
            Pour toute question relative à la plateforme, vous pouvez nous contacter à :{" "}
            <a href="mailto:contact@civiq.fr">contact@civiq.fr</a>
          </p>
        </section>

        <section>
          <h2>2. Hébergement</h2>
          <p>
            La plateforme CiviQ est hébergée par :
          </p>
          <ul>
            <li><strong>Vercel Inc.</strong> — infrastructure Next.js (États-Unis)</li>
            <li><strong>Supabase Inc.</strong> — base de données PostgreSQL (région EU West)</li>
          </ul>
          <p>
            Les données sont stockées dans des centres de données conformes au RGPD.
          </p>
        </section>

        <section>
          <h2>3. Propriété intellectuelle</h2>
          <p>
            L'ensemble du contenu de la plateforme CiviQ (textes, graphismes, logos, code source)
            est protégé par le droit d'auteur. Toute reproduction ou utilisation sans autorisation
            expresse est interdite.
          </p>
          <p>
            Les données des sondages appartiennent aux communes qui les créent. CiviQ ne revendique
            aucun droit sur les données collectées par les communes via la plateforme.
          </p>
        </section>

        <section>
          <h2>4. Responsabilité</h2>
          <p>
            CiviQ met à disposition une plateforme technique. La commune est responsable du contenu
            de ses sondages, de leur conformité légale, et de l'information des participants.
          </p>
          <p>
            CiviQ ne saurait être tenu responsable des interruptions de service liées à des causes
            extérieures (pannes réseau, maintenance des hébergeurs, etc.).
          </p>
        </section>

        <section>
          <h2>5. Données personnelles</h2>
          <p>
            Le traitement des données personnelles collectées via la plateforme est décrit dans
            notre{" "}
            <Link href="/confidentialite">politique de confidentialité</Link>.
          </p>
        </section>

        <section>
          <h2>6. Cookies</h2>
          <p>
            La plateforme utilise des cookies techniques strictement nécessaires au fonctionnement
            de l'authentification (session Supabase). Aucun cookie de traçage ou publicitaire
            n'est utilisé.
          </p>
        </section>

        <section>
          <h2>7. Droit applicable</h2>
          <p>
            Les présentes mentions légales sont régies par le droit français. Tout litige relatif
            à l'utilisation de la plateforme relève de la compétence exclusive des tribunaux français.
          </p>
        </section>
      </div>

      <style>{`
        .legal-page {
          min-height: 100vh;
          background: #f2efe8;
          padding: 40px 24px 80px;
          font-family: 'Source Sans 3', -apple-system, sans-serif;
        }
        .legal-container {
          max-width: 720px;
          margin: 0 auto;
        }
        .legal-back {
          display: inline-block;
          font-size: 14px;
          color: #3b6fa0;
          text-decoration: none;
          margin-bottom: 32px;
          font-weight: 500;
        }
        .legal-back:hover { text-decoration: underline; }
        .legal-page h1 {
          font-family: 'Playfair Display', serif;
          font-size: 36px;
          font-weight: 700;
          color: #1a2744;
          margin-bottom: 4px;
        }
        .legal-date {
          font-size: 13px;
          color: #999;
          margin-bottom: 40px;
        }
        .legal-page section {
          background: #fff;
          border-radius: 12px;
          padding: 28px 32px;
          margin-bottom: 16px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .legal-page h2 {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 700;
          color: #1a2744;
          margin-bottom: 14px;
        }
        .legal-page p {
          font-size: 15px;
          color: #444;
          line-height: 1.7;
          margin-bottom: 12px;
        }
        .legal-page p:last-child { margin-bottom: 0; }
        .legal-page ul {
          padding-left: 20px;
          margin: 8px 0 12px;
        }
        .legal-page li {
          font-size: 15px;
          color: #444;
          line-height: 1.7;
          margin-bottom: 4px;
        }
        .legal-page a {
          color: #3b6fa0;
          text-decoration: none;
        }
        .legal-page a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
