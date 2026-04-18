# CLAUDE.md — Historique de développement CiviQ

> Ce fichier sert d'historique conversationnel pour le développement de CiviQ avec Claude.ai.
> Chaque session de développement est documentée ici avec les décisions prises et les modules livrés.

---

## Contexte du projet

**Commanditaire :** Commune de Châteauneuf (maire)
**Objectif initial :** Plateforme de sondage périscolaire envoyée aux parents d'élèves pour recenser les besoins en :
- Accueil le mercredi après-midi
- Centre de loisirs pendant les vacances scolaires
- Service d'aide aux devoirs (bénévoles)
- Accueil des collégiens
- Identification de bénévoles

**Vision produit :** Plateforme SaaS multi-tenant revendable à d'autres communes (modèle modulaire).

---

## Session 1 — Fondations (2026-04-18)

### Prompt de départ
> "Plateforme de sondage périscolaire pour Châteauneuf, réutilisable (revendable à d'autres communes), modulaire, sous forme de modules indépendants à activer ou non."

### Décisions d'architecture
- **Stack** : Next.js 15 (App Router) + Supabase (PostgreSQL + Auth) + Vercel
- **Multi-tenant** : Isolation par `commune_id` + Row Level Security Supabase
- **Survey Schema** : Format JSON flexible stocké en colonne `jsonb` → permet n'importe quel sondage sans migration SQL
- **Templates** : Table `survey_templates` pour les modèles partagés entre communes
- **Auth** : Email/password + Magic link Supabase

### Modules livrés en Session 1
1. **Schéma de base de données** (`supabase/migrations/001_initial_schema.sql`)
   - Tables : `communes`, `profiles`, `surveys`, `responses`, `survey_templates`
   - Row Level Security complet
   - Fonction `get_survey_stats()`

2. **SurveyRenderer** (`src/components/survey/SurveyRenderer.tsx`)
   - Moteur de rendu multi-étapes dynamique
   - Types supportés : text, email, tel, textarea, select, radio, checkbox, checkbox_grid, scale
   - Champs conditionnels, validation, animations Framer Motion
   - Barre de progression, écran de remerciement

3. **Pages publiques** (survey/[slug])
   - Branding dynamique par commune (couleurs, logo)
   - Métadonnées SEO générées côté serveur
   - Gestion de la date de clôture

4. **Admin** (dashboard, new survey, results)
   - Dashboard avec stats (total sondages, actifs, réponses)
   - Création de sondage depuis template
   - Page de résultats avec graphiques Recharts (bar, pie)
   - Export CSV UTF-8 BOM

5. **Auth** (login + callback)
   - Connexion email/password ou magic link
   - Middleware de protection des routes `/admin`

6. **API Routes**
   - `GET/POST /api/surveys` — liste et création
   - `POST /api/responses` — soumission avec anti-doublon IP
   - `GET /api/export` — export CSV/JSON

7. **Landing page** marketing

---

## Session 2 — Corrections et complétude (2026-04-18)

### Problèmes identifiés et corrigés

#### 🔴 Critiques (pages manquantes)
- ✅ `/auth/register` — Page d'inscription email/password créée
- ✅ `/auth/reset-password` — Réinitialisation de mot de passe créée
- ✅ `/admin/setup` — Configuration de la commune après inscription (nom, code postal, couleurs)
- ✅ `/api/auth/setup` — API service-role pour créer commune + profil (contournement RLS)
- ✅ `/demo/periscolaire` — Démo interactive du sondage périscolaire (sans sauvegarde BDD)
- ✅ `/auth/callback` — Modifié pour détecter les nouveaux utilisateurs → redirect vers `/admin/setup`

#### 🟡 Type Safety
- ✅ Suppression des `as any` dans `admin/dashboard/page.tsx`
  - Ajout de `ProfileWithCommune` interface pour le join Supabase
  - Typage correct de `SurveyRow[]` et des `responses` agrégées
- ✅ Suppression des `as any` dans `survey/[slug]/page.tsx`
  - Ajout de `SurveyWithCommune` type pour le join `surveys + communes`

#### 🟡 Champs manquants dans SurveyRenderer
- ✅ `date` — Rendu `<input type="date">`
- ✅ `number` — Rendu `<input type="number">` avec min/max

#### 🟡 Dépendances inutilisées supprimées de package.json
- ✅ `zustand` — Supprimé (aucune utilisation)
- ✅ `react-hook-form` — Supprimé (aucune utilisation)
- ✅ `@hookform/resolvers` — Supprimé (aucune utilisation)
- ✅ `zod` — Supprimé (aucune utilisation)

#### 🆕 Nouvelles fonctionnalités

**SurveyBuilder** (`src/components/survey/SurveyBuilder.tsx`)
- Éditeur visuel complet du schema JSON d'un sondage
- Gestion des étapes : ajout, suppression, réordonnancement
- Gestion des champs par étape : ajout, suppression, réordonnancement
- Éditeur inline de chaque champ :
  - Tous les types supportés (11 types)
  - Label, hint, placeholder, required
  - Options (label + valeur + sous-titre) avec ajout/suppression
  - Scale : min, max, labels extremes
  - Number : min, max
  - Checkbox_grid : colonnes (1 ou 2)
  - Champs conditionnels (basés sur d'autres champs)
- Paramètres globaux du sondage (durée estimée, anonymat, barre de progression)

**Page d'édition** (`src/app/admin/surveys/[id]/edit/page.tsx`)
- Interface split : builder à gauche, paramètres à droite
- Barre sticky en haut : titre éditable inline, statut, boutons Sauvegarder / Publier / Dépublier
- Sauvegarde automatique du statut (saved / saving / error)
- Paramètres : description, date de clôture, textes personnalisés

**API PATCH/DELETE** (`src/app/api/surveys/[id]/route.ts`)
- `GET /api/surveys/:id` — Récupération sécurisée (vérif commune)
- `PATCH /api/surveys/:id` — Mise à jour partielle (schema, statut, métadonnées)
- `DELETE /api/surveys/:id` — Suppression (admin uniquement)

**Bouton Modifier** ajouté dans le tableau du dashboard (icône ✏️)

---

## Architecture des modules (vision SaaS)

```
Module CORE (toujours actif)
├── Auth multi-tenant (communes)
├── SurveyRenderer (rendu public)
├── SurveyBuilder (éditeur admin)
├── Dashboard (statistiques)
└── Export CSV/JSON

Module PERISCOLAIRE
├── Template "Besoins périscolaires" complet (5 étapes)
├── Demo interactive /demo/periscolaire
└── Questions : cantine, mercredi, vacances, collège, bénévolat

Module BUDGET_PARTICIPATIF (à venir)
└── Template priorisation d'investissements

Module URBANISME (à venir)
└── Template aménagement, mobilité, cadre de vie

Module NOTIFICATIONS (à venir)
└── Emails de confirmation aux répondants

Module PDF_REPORT (à venir)
└── Rapport PDF automatique des résultats
```

---

## Flux d'inscription (nouveau)

```
1. /auth/register
   → signUp(email, password)
   → Email de confirmation Supabase

2. Clic sur le lien email
   → /auth/callback
   → exchangeCodeForSession()
   → Vérifie si profile.commune_id existe
   → Si NON → /admin/setup
   → Si OUI → /admin/dashboard

3. /admin/setup
   → Formulaire : nom commune, code postal, email, couleurs
   → POST /api/auth/setup (service role)
   → Crée commune + profile en base
   → Redirect /admin/dashboard
```

---

## Points d'attention pour la suite

- **SQL migration** : Pas de politique INSERT sur `profiles` pour les nouveaux users → géré via `/api/auth/setup` avec le service role key. ✅
- **Slug de commune** : Généré automatiquement depuis le nom, avec fallback si doublon. ✅
- **Templates périscolaires** : Le template doit être inséré manuellement en BDD via SQL ou via l'interface super_admin (à venir).
- **Reset de mot de passe** : Nécessite la page `/auth/update-password` (non encore créée) pour que l'utilisateur saisisse son nouveau mot de passe après le clic sur le lien email.
- **Suppression de node_modules** : Après modification de package.json, lancer `npm install` pour régénérer le lockfile.

---

## Commandes utiles

```bash
# Développement
npm run dev

# Générer les types Supabase (si CLI Supabase installé)
npm run db:types

# Appliquer les migrations
npm run db:migrate

# Nettoyer les dépendances après package.json update
rm -rf node_modules && npm install
```

---

## Variables d'environnement requises

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx   # Uniquement côté serveur
```
