# 🏛 CiviQ — Plateforme de sondages civiques

**Plateforme modulaire de sondages et consultations citoyennes pour les collectivités locales françaises.**

Chaque commune dispose de son espace personnalisé (branding, couleurs, logo) pour créer, publier et analyser des sondages auprès de ses administrés.

---

## 🏗 Architecture

```
civiq/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes
│   │   │   ├── surveys/        # CRUD sondages
│   │   │   ├── responses/      # Soumission réponses
│   │   │   ├── auth/           # Authentification
│   │   │   └── export/         # Export CSV/JSON
│   │   ├── survey/[slug]/      # Page publique sondage
│   │   ├── admin/              # Dashboard admin
│   │   │   ├── surveys/        # Gestion sondages
│   │   │   └── dashboard/      # Statistiques
│   │   └── (public)/           # Pages marketing
│   ├── components/
│   │   ├── survey/             # SurveyRenderer, SurveyBuilder
│   │   ├── admin/              # Dashboard, charts
│   │   ├── ui/                 # Composants réutilisables
│   │   └── layout/             # Header, Footer, Sidebar
│   ├── lib/                    # Clients Supabase, utilitaires
│   ├── types/                  # Types TypeScript
│   └── hooks/                  # Custom hooks React
├── supabase/
│   └── migrations/             # Schéma SQL
├── public/                     # Assets statiques
└── docs/                       # Documentation
```

## 🧱 Stack technique

| Couche | Technologie | Pourquoi |
|--------|-------------|----------|
| **Frontend** | Next.js 15 (App Router) | SSR, API Routes, SEO |
| **UI** | Tailwind CSS 4 + Framer Motion | Rapide, responsive, animations |
| **Forms** | React Hook Form + Zod | Validation robuste |
| **Base de données** | Supabase (PostgreSQL) | Gratuit jusqu'à 500 Mo, RLS, Auth |
| **Auth** | Supabase Auth | Email/magic link, RBAC |
| **Charts** | Recharts | Graphiques dashboard |
| **Export** | PapaParse | CSV natif |
| **Déploiement** | Vercel | Gratuit, preview auto |
| **Repo** | GitHub | CI/CD vers Vercel |

## 🚀 Démarrage rapide

### 1. Cloner et installer

```bash
git clone https://github.com/votre-org/civiq.git
cd civiq
npm install
```

### 2. Configurer Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (gratuit)
2. Copier `.env.example` → `.env.local` et remplir les clés
3. Appliquer le schéma :

```bash
npx supabase db push
```

### 3. Lancer en local

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

### 4. Déployer

```bash
# Connecter à Vercel
npx vercel

# Les variables d'env sont configurées dans le dashboard Vercel
```

## 📋 Concept modulaire

Le cœur de CiviQ est le **Survey Schema** : un format JSON qui décrit n'importe quel sondage.

```typescript
interface SurveySchema {
  settings: { allow_anonymous, show_progress, estimated_time }
  steps: [
    {
      id: "foyer",
      title: "Votre foyer",
      fields: [
        { id: "nb_enfants", type: "select", options: [...] },
        { id: "niveaux", type: "checkbox_grid", columns: 2, options: [...] },
      ]
    },
    // ... autres étapes
  ]
}
```

**Types de champs supportés** :
- `text`, `email`, `tel` — Champs texte
- `textarea` — Zone de texte libre
- `select` — Liste déroulante
- `radio` — Choix unique
- `checkbox` — Choix multiples
- `checkbox_grid` — Grille de cases à cocher (1 ou 2 colonnes)
- `scale` — Échelle numérique (1-5, 1-10…)
- `number`, `date` — Champs spécialisés

**Champs conditionnels** :
```json
{
  "id": "creneaux_devoirs",
  "type": "checkbox_grid",
  "conditional": { "field": "aide_devoirs", "value": ["oui_primaire", "oui_college", "oui_les_deux"] }
}
```

## 🏢 Multi-tenant

Chaque commune est un **tenant** isolé :
- Branding personnalisé (couleurs, logo)
- Données isolées via Row Level Security (RLS)
- URL publique : `/survey/periscolaire-2026?commune=chateauneuf-85`
- Rôles : `super_admin` > `admin` > `editor` > `viewer`

## 📊 Templates disponibles

| Template | Catégorie | Description |
|----------|-----------|-------------|
| Besoins périscolaires | `periscolaire` | Cantine, mercredi, vacances, aide aux devoirs, bénévolat |
| *(à venir)* Budget participatif | `budget` | Priorisation des investissements |
| *(à venir)* Urbanisme | `urbanisme` | Aménagement, mobilité, cadre de vie |
| *(à venir)* Satisfaction services | `satisfaction` | Évaluation des services municipaux |

## 🔧 Développement avec Claude

Ce projet est conçu pour être développé itérativement avec Claude.ai :

1. **Chaque module = une conversation Claude** avec un historique conservé
2. **Prompt pattern** : décrire le besoin fonctionnel → Claude génère le code → itérer
3. **Modules à développer** :
   - `SurveyBuilder` — Éditeur drag & drop de sondages
   - `AdminDashboard` — Statistiques et graphiques
   - `CommuneOnboarding` — Inscription et personnalisation
   - `NotificationSystem` — Emails de confirmation
   - `AdvancedExport` — Rapports PDF automatiques

## 💰 Coûts

| Service | Tier gratuit | Limites |
|---------|-------------|---------|
| **Supabase** | Free | 500 Mo, 50k auth users, 500k edge invocations |
| **Vercel** | Hobby | 100 Go bandwidth, serverless functions |
| **GitHub** | Free | Repos privés illimités |
| **Total** | **0 €/mois** | Suffisant pour ~50 communes × ~5 sondages |

Au-delà : Supabase Pro (25$/mois) + Vercel Pro (20$/mois) = 45$/mois pour une utilisation intensive.

## 📜 Licence

MIT — Libre d'utilisation pour toute collectivité.

---

*Développé avec ❤️ pour les communes françaises*
# civiq
