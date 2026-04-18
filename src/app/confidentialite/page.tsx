import Link from "next/link";

// ═══════════════════════════════════════════════════
// POLITIQUE DE CONFIDENTIALITÉ — Page statique RGPD
// ═══════════════════════════════════════════════════

export const metadata = {
  title: "Politique de confidentialité — CiviQ",
  description: "Comment CiviQ traite et protège vos données personnelles",
};

export default function ConfidentialitePage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link href="/" className="legal-back">
          ← Retour à l'accueil
        </Link>

        <h1>Politique de confidentialité</h1>
        <p className="legal-date">Dernière mise à jour : avril 2026</p>

        <div className="legal-highlight">
          <strong>En résumé :</strong> CiviQ collecte uniquement les données nécessaires au
          fonctionnement de la plateforme. Vos données ne sont jamais vendues ni partagées
          avec des tiers à des fins commerciales.
        </div>

        <section>
          <h2>1. Responsable du traitement</h2>
          <p>
            Le responsable du traitement des données est l'éditeur de la plateforme CiviQ.
            Pour exercer vos droits ou pour toute question relative à la protection de vos
            données, contactez-nous à :{" "}
            <a href="mailto:privacy@civiq.fr">privacy@civiq.fr</a>
          </p>
        </section>

        <section>
          <h2>2. Données collectées</h2>

          <h3>Pour les administrateurs de communes</h3>
          <ul>
            <li>Adresse email (identifiant de connexion)</li>
            <li>Nom complet (optionnel)</li>
            <li>Informations de la commune (nom, code postal, logo, couleurs)</li>
          </ul>

          <h3>Pour les participants aux sondages</h3>
          <ul>
            <li>Réponses aux questions du sondage</li>
            <li>Adresse email (si demandée et fournie volontairement)</li>
            <li>Date et heure de soumission</li>
            <li>Aucune donnée de navigation ni d'identification technique n'est collectée</li>
          </ul>
        </section>

        <section>
          <h2>3. Finalités du traitement</h2>
          <table>
            <thead>
              <tr>
                <th>Finalité</th>
                <th>Base légale</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Authentification et gestion du compte administrateur</td>
                <td>Exécution du contrat</td>
              </tr>
              <tr>
                <td>Collecte des réponses aux sondages citoyens</td>
                <td>Mission d'intérêt public (commune)</td>
              </tr>
              <tr>
                <td>Amélioration de la plateforme</td>
                <td>Intérêt légitime (données agrégées)</td>
              </tr>
              <tr>
                <td>Envoi d'emails transactionnels (confirmation, réinitialisation)</td>
                <td>Exécution du contrat</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>4. Conservation des données</h2>
          <ul>
            <li><strong>Comptes administrateurs</strong> : conservés tant que le compte est actif, puis supprimés 90 jours après résiliation</li>
            <li><strong>Réponses aux sondages</strong> : conservées selon la durée définie par la commune, par défaut 3 ans</li>
            <li><strong>Logs de sécurité</strong> : 12 mois maximum</li>
          </ul>
        </section>

        <section>
          <h2>5. Partage des données</h2>
          <p>
            Les données ne sont jamais vendues. Elles peuvent être partagées avec :
          </p>
          <ul>
            <li>
              <strong>Vercel</strong> — hébergement de l'application (certifié SOC 2 Type II)
            </li>
            <li>
              <strong>Supabase</strong> — base de données, stockée en EU West (conforme RGPD)
            </li>
          </ul>
          <p>
            Ces sous-traitants sont liés par des contrats de traitement de données (DPA)
            conformes au RGPD.
          </p>
        </section>

        <section>
          <h2>6. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
          </p>
          <ul>
            <li><strong>Droit d'accès</strong> : obtenir une copie de vos données</li>
            <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
            <li><strong>Droit à l'effacement</strong> : supprimer vos données (« droit à l'oubli »)</li>
            <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
            <li><strong>Droit d'opposition</strong> : s'opposer à certains traitements</li>
          </ul>
          <p>
            Pour exercer ces droits, contactez :{" "}
            <a href="mailto:privacy@civiq.fr">privacy@civiq.fr</a>
          </p>
          <p>
            Vous pouvez également introduire une réclamation auprès de la{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">
              CNIL
            </a>{" "}
            (Commission Nationale de l'Informatique et des Libertés).
          </p>
        </section>

        <section>
          <h2>7. Sécurité</h2>
          <p>
            CiviQ met en œuvre des mesures techniques et organisationnelles appropriées pour
            protéger vos données :
          </p>
          <ul>
            <li>Chiffrement des données en transit (TLS 1.3)</li>
            <li>Chiffrement des données au repos (AES-256)</li>
            <li>Isolation des données par commune via Row Level Security (RLS) PostgreSQL</li>
            <li>Authentification sécurisée (bcrypt, tokens JWT signés)</li>
            <li>Accès administrateur restreint et audité</li>
          </ul>
        </section>

        <section>
          <h2>8. Cookies</h2>
          <p>
            La plateforme utilise uniquement des cookies techniques essentiels :
          </p>
          <ul>
            <li>
              <strong>sb-auth-token</strong> — cookie de session Supabase, nécessaire à
              l'authentification. Durée : session ou 7 jours si "se souvenir de moi".
            </li>
          </ul>
          <p>
            Aucun cookie analytique, publicitaire ou de traçage n'est déposé.
          </p>
        </section>

        <section>
          <h2>9. Modifications</h2>
          <p>
            Cette politique peut être mise à jour. En cas de modification substantielle,
            les administrateurs de communes seront informés par email.
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
          margin-bottom: 24px;
        }
        .legal-highlight {
          background: #e8f0f8;
          border-left: 4px solid #3b6fa0;
          border-radius: 0 8px 8px 0;
          padding: 16px 20px;
          font-size: 14px;
          color: #1a2744;
          line-height: 1.6;
          margin-bottom: 24px;
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
        .legal-page h3 {
          font-size: 15px;
          font-weight: 700;
          color: #1a2744;
          margin: 16px 0 8px;
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
          margin-bottom: 6px;
        }
        .legal-page a {
          color: #3b6fa0;
          text-decoration: none;
        }
        .legal-page a:hover { text-decoration: underline; }
        .legal-page table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 14px;
        }
        .legal-page th {
          background: #f2efe8;
          padding: 10px 14px;
          text-align: left;
          font-weight: 600;
          color: #1a2744;
          border-bottom: 2px solid #e8e5de;
        }
        .legal-page td {
          padding: 10px 14px;
          color: #444;
          border-bottom: 1px solid #f0ede6;
          vertical-align: top;
        }
        .legal-page tr:last-child td { border-bottom: none; }
      `}</style>
    </div>
  );
}
