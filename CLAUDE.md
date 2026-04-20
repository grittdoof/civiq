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

---

## Session 3 — Pages légales, commit initial, premiers bugs (2026-04-19)

### Pages légales créées
- ✅ `/mentions-legales` — 7 sections (éditeur, hébergement, IP, responsabilité, données, cookies, droit applicable)
- ✅ `/confidentialite` — Politique RGPD avec tableau des finalités
- ✅ Lien « Mot de passe oublié » ajouté dans `/auth/login`

### Premier push GitHub
- Commit `1810b16` + `2c78631` → `grittdoof/civiq` sur `main`

### Bugs remontés
- 🐛 Dashboard bloqué sur « Chargement… »
- 🐛 Création de sondage cassée
- 🐛 Paramètres de commune cassés

### Fixes round 1 (commit `a4d1efb`)
- Wrapping de tous les `loadData()` dans try/finally (sinon `setLoading(false)` jamais appelé si la query échoue)
- `createError` state + redirect vers `/edit` dans `/admin/surveys/new`
- Migration `002_fix_rls_policies.sql` (v1)

---

## Session 4 — Correction RLS récursive (2026-04-19)

### Problème racine
Le 403 « Permissions insuffisantes » venait de policies RLS **récursives** :
```sql
using (commune_id in (select commune_id from profiles where id = auth.uid()))
```
→ cette subquery déclenche la policy SELECT sur `profiles`, qui elle-même contient la même subquery → boucle → `NULL` → tout bloqué.

### Solution (commit `a2cc335`)
1. Fonctions `SECURITY DEFINER` qui bypass RLS sur `profiles` :
   - `public.my_commune_id()` → `uuid`
   - `public.my_role()` → `text`
2. Toutes les policies réécrites pour utiliser ces fonctions au lieu de subqueries
3. Policy directe « Users can view own profile » (non-récursive)
4. Belt-and-suspenders : toutes les API routes lisent `profiles` via `createServiceClient()` (service role key, bypass RLS complet)
5. Nouvelle route `/api/auth/me` centralisée

---

## Session 5 — Super-admin, modules, multi-admin, design Airbnb (2026-04-20)

### Prompt de départ
> "Il faut un mode super administrateur qui gère la plateforme et puisse activer les modules. Les administrateurs éditeur (les mairies) possèdent leur propre espace qui contient le ou les modules activés. Chaque espace peut avoir plusieurs utilisateurs administrateurs. S'inspirer d'Airbnb pour le design. Fais un checkup global et corrige les bugs."

### Architecture finale des rôles
| Rôle | Scope | Peut |
|---|---|---|
| `super_admin` | Plateforme entière | Gérer toutes les communes, activer/désactiver les modules au catalogue, promouvoir des users, voir stats globales |
| `admin` | Sa commune | Gérer membres de sa mairie, activer les modules pour sa commune, inviter des éditeurs, éditer les paramètres |
| `editor` | Modules activés de sa commune | Créer, éditer, publier, supprimer des sondages (et autres modules quand ils existeront) |
| `viewer` (*administré*) | Public | Compte simple lecteur. Pas d'accès admin ni modules. Rôle réservé pour features futures (suivi d'inscription, historique de participation) |

### Livrés — Migration 003
Tables : `modules`, `commune_modules`, `commune_invitations`
Fonctions : `my_active_modules()`, `make_super_admin(email)`
Vue : `commune_stats`
Seed : 5 modules (surveys, budget, events, alerts, urbanism)
Auto-activation `surveys` pour toutes les communes existantes

### Livrés — Backend
- `src/lib/auth-helpers.ts` : `getAuthContext()`, `isSuperAdmin()`, `isCommuneAdmin()`
- `src/app/api/auth/me/route.ts` enrichi avec `is_super_admin` + `modules` activés
- API super-admin : `/api/super-admin/{communes,users,modules}/route.ts`
- API team : `/api/team/route.ts`, `/api/team/invite/route.ts`
- API modules : `/api/modules/activate/route.ts`
- API invitations : `/api/invitations/accept/route.ts` (token + preview + POST accept)

### Livrés — Frontend
- Layout `/super-admin/*` avec sidebar sombre + garde client-side
- Pages super-admin : dashboard (stats + grid communes), communes (table searchable), users (rôle éditable inline)
- Refonte `globals.css` avec design system Airbnb :
  - `--civiq-accent: #ff5a5f` (coral signature)
  - `--civiq-radius: 16px` (généreux)
  - Cards blanches avec borders subtiles
  - Boutons gradients + shadows douces
  - Pill badges

### Fixes & polish (commit `51a1dfb`)
- `createServiceClient` manquant dans l'import de `/api/surveys/route.ts` (cause de « Unexpected end of JSON input »)
- `slugify()` avec strip d'accents + collapse de tirets multiples (plus de `besoins-priscolaires--extrascolaires`)
- `/survey/[slug]` : message « Sondage non encore publié » au lieu d'un 404 sec pour les drafts
- Dashboard admin : lien public visible et cliquable pour **tous** les statuts (plus seulement `published`)
- Retrait du lien hardcodé `👁 Voir le sondage en ligne` dans la sidebar

### Migration 003 : problèmes rencontrés et solutions
- ❌ `function public.my_role() does not exist` → migration 002 jamais passée
- ❌ `42710: policy "Users can view own profile" for table "profiles" already exists` → `create policy` nu dans 002 non-idempotent
- ✅ Solution : bloc rejouable avec `drop policy if exists` + `create or replace function` fourni en session
- ❌ `42P07: relation "modules" already exists` → 003 partiellement appliqué
- ✅ Solution : bloc rejouable qui saute les tables, force seed via `on conflict do nothing`, recrée policies + fonctions + vue

---

## Session 6 — Profil, suppression sondage, CSS ajustements, docs (2026-04-20)

### Prompt de départ
> "Dans 'profil & paramètres' il faut afficher le statut du compte. Les différents profils sont : Super Administrateur (gère la plateforme), Éditeur (agents territoriaux, adjoints, conseillers municipaux rattachés à un espace mairie), Administré (compte par défaut en lecture). Dans le module Sondage, permettre la suppression. CSS : `.civiq-field-label` avec display block + 15px + bleu-nuit + margin 8px, `.civiq-btn` texte blanc. Bien mettre tout le suivi."

### Livrés
- **Profil** : bloc « Statut du compte » en tête de page avec icône, libellé et description du rôle courant (mapping `ROLE_META` dans `src/app/admin/profile/page.tsx`)
- **Dashboard admin** : bouton de suppression 🗑 avec confirmation native + optimistic update de la liste
- **API** : `DELETE /api/surveys/[id]` étendu à `editor` (avant : admin + super_admin)
- **CSS globals** :
  - Ajout `--bleu-nuit: #1a2744` dans `:root` (alias sémantique de `--civiq-primary`)
  - `.civiq-field-label` : display block, 15px, 600, `var(--bleu-nuit)`, margin-bottom 8px
  - `.civiq-btn` : `color: #fff` par défaut (variants `secondary`/`ghost` continuent à override avec `var(--civiq-text)`)
- **Docs** :
  - CLAUDE.md enrichi de Sessions 3→6 (ce fichier)
  - CHANGELOG.md créé (user-facing, versionné par date)
  - ROADMAP.md créé (feuille de route par modules + phases)

---

## Points d'attention courants

### Toujours utiliser `createServiceClient()` pour lire `profiles`
Les policies RLS de `profiles` sont protégées par `my_commune_id()` / `my_role()` qui lisent elles-mêmes `profiles` en SECURITY DEFINER. Mais en cas de doute ou sur les routes sensibles, passer par le service role reste le plus sûr. **Toujours** importer `createServiceClient` explicitement, pas seulement `createClient` (oublier cet import = 500 silencieuse = `Unexpected end of JSON input` côté client).

### Slug de sondage
Normalisé via `slugify()` dans `src/app/api/surveys/route.ts` :
- Strip accents NFD (`é`→`e`, `à`→`a`, `ç`→`c`)
- Retire les apostrophes
- Tout caractère non-alphanum → tiret
- Collapse tirets multiples
- Trim tirets en début/fin

### Migration idempotente
Toutes les futures migrations **doivent** utiliser :
- `create or replace function` pour les fonctions
- `drop policy if exists` avant `create policy`
- `on conflict do nothing` pour les seeds
- `create index if not exists` pour les index
Rien ne doit casser si la migration est rejouée.

