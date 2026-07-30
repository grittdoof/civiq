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


---

## Session 7 — Module « Gestion de projet » (2026-06-07)

### Prompt de départ
> "Développe un nouveau module **Gestion de projet** permettant à une mairie de piloter ses projets d'investissement (voirie, équipements, aménagements…) en respectant un cycle de vie standard en 7 étapes avec des portes de validation, et en associant les parties prenantes à chaque étape."

### Décisions d'architecture
- **Multi-tenant** : isolation `commune_id` + RLS, restriction `admin|editor|super_admin` (pas de viewer/citoyen, comme tickets).
- **Machine à états** : implémentée en **double** — RPC SQL `advance_project_phase()` source d'autorité + state-machine TS pure pour l'UX, miroir 1:1.
- **Porte de financement** : règle non négociable, vérifiée côté serveur, non contournable même par force admin.
- **Taux d'inflation / actualisation** : nouvelle table `commune_settings` (cohérence avec future extensibilité), surchargeables par projet.
- **Signature électronique** : canvas tactile → PNG base64 dans `session_attendance.signature_data` (MVP simple, autonome, horodaté).
- **Tests** : Vitest pour la logique pure (state-machine + cost-calc), 47 tests verts.

### Migration 017 (1046 lignes, idempotente)
- 8 enums : `project_phase`, `project_competence`, `stakeholder_type`, `stakeholder_role`, `financing_status`, `commission_member_role`, `commission_session_statut`, `session_decision_type`.
- 16 tables : `commune_settings`, `projects`, `project_phase_log`, `project_subscribers`, `stakeholders`, `project_stakeholders` (RACI), `financings`, `milestones`, `project_lifecycle_costs` (1..10 ans), `project_documents`, `commissions`, `commission_members`, `commission_projects`, `commission_sessions`, `session_attendance`, `session_decisions`.
- Fonctions/RPC : `project_phase_index`, `project_can_advance(uuid, phase)`, `advance_project_phase(uuid, phase, text, bool)`, `project_global_cost(uuid)`, `user_can_edit_project(uuid)`.
- Triggers : auto-abonnement des pilotes, `updated_at`, décision type=action → jalon auto.
- Buckets Storage : `project-documents`, `commission-pdfs`.
- Lien `tickets.project_id` + extension `notification_preferences` (4 nouvelles colonnes).
- Module catalogue inséré, **pas d'activation auto** (catalogue uniquement).

### Architecture du code
```
src/lib/projects/
├── types.ts            — miroirs des enums + labels FR + interfaces
├── state-machine.ts    — décision pure de transition (mirroir RPC)
├── cost-calc.ts        — computeGlobalCost / computeEcart / formatters
├── queries.ts          — listProjects, getProject, getCommission, getSession…
├── api-helpers.ts      — requireProjectAccess / requireProjectEdit
├── push.ts             — sendProjectNotification + déclencheurs
├── pdf-document.tsx    — fiche projet
└── pdf-commission.tsx  — émargement + compte rendu

src/components/projects/  (composants client)
├── ProjectKanbanCard, ProjectStepper, ProjectPhaseAdvanceDialog
├── FinancingsEditor, StakeholdersEditor, LifecycleCostsEditor,
│   MilestonesEditor, BilanEditor, SubscribersEditor, ProjectForm
├── CostComparisonChart, PrintButton, TransformTicketButton
├── NewCommissionDialog, CommissionMembersEditor,
│   CommissionProjectsEditor, NewSessionForm
└── SignaturePad, AttendanceEditor, MinutesEditor

src/app/admin/projects/
├── page.tsx            — kanban 7 colonnes + bandeau financier
├── nouveau/page.tsx    — création (préremplissage from_ticket=…)
├── comparatif/page.tsx — table triée + chart barres
├── cartographie/page.tsx — vue transversale parties prenantes
├── revue-mensuelle/page.tsx — synthèse imprimable
└── [id]/
    ├── page.tsx        — fiche complète avec éditeurs interactifs
    └── edit/page.tsx   — édition des champs scalaires

src/app/admin/commissions/
├── page.tsx
└── [id]/
    ├── page.tsx        — membres + projets + séances
    └── sessions/
        ├── nouvelle/page.tsx
        └── [sid]/page.tsx  — émargement + CR

src/app/api/projects/**        — toutes routes gated requireModule('projects')
src/app/api/commissions/**
src/app/api/stakeholders       — annuaire commune
src/app/api/commune-settings   — taux inflation/actualisation
```

### Points d'attention
- **Toujours appeler `advance_project_phase` via la RPC**, pas un UPDATE direct. La RPC vérifie les permissions et la porte.
- **`tickets.project_id`** ajouté par migration 017 (cross-module) — le type `Ticket` a une nouvelle propriété optionnelle.
- **Storage buckets** : 20 MB max pour documents/PDFs, signed URLs via service role.
- **Notifications projets** : nouveaux préfs `notify_project_phase`, `notify_project_milestone`, `notify_project_financing`, `notify_commission` — default true.
- **Vitest** ajouté aux devDeps : `npm test` lance `tests/unit/**/*.test.ts`.

### Tests
```
npm test  → 47 ✓
- tests/unit/projects/state-machine.test.ts (29)
- tests/unit/projects/cost-calc.test.ts (18)
```

---

## Session 8 — Module Sondage : mode « inscription à un événement » (2026-07-22)

### Prompt de départ
> "Dans le module sondage : quand je sélectionne liste déroulante, ce n'est pas une liste déroulante. Le call to action de départ est « Commencer le sondage » mais je dois pouvoir le personnaliser pour créer des inscriptions à des events gratuits. Permettre d'ajouter un visuel au format bannière (l'indiquer dans le back office) et le lieu sur une maps ; l'utilisateur doit pouvoir ajouter à son agenda avant de remplir le formulaire d'inscription, et à la fin du formulaire se rendre à l'événement via une maps et ajouter l'événement à son agenda."

### Décision d'architecture
Tous les réglages vivent dans **`surveys.schema.settings`** (jsonb) — cohérent avec le principe fondateur du module (« n'importe quel sondage sans migration SQL »). Seule la bannière nécessitait du stockage binaire → migration 031 pour le bucket.

```ts
settings: {
  start_cta?: string;             // texte du bouton d'entrée
  banner_url?: string;            // visuel bannière (bucket public)
  banner_storage_path?: string;   // chemin interne, pour le nettoyage
  event?: {
    enabled, starts_at, ends_at, all_day,
    location: { name, address, lat, lng },
    organizer, details,
  }
}
```

### Livrés
- **Fix « liste déroulante »** : le type `select` rendait la même liste de boutons que `radio`. Il rend maintenant une vraie `<select>` native (`civiq-flow-select`), avec placeholder et chevron. `radio` reste la version en cartes empilées.
- `src/lib/survey-event.ts` — génération ICS (RFC 5545 : échappement, pliage à 75 caractères, VALARM -2h), URLs Google Agenda / Outlook, liens Google Maps (itinéraire + recherche), formatage FR des dates.
- `src/components/survey/EventCard.tsx` — bloc événement (date, lieu, carte, menu agenda, itinéraire), affiché sur l'écran d'accueil **et** sur l'écran de confirmation.
- `src/components/survey/EventMap.tsx` — mini-carte Leaflet + tuiles OSM.
- `src/components/survey/EventSettingsPanel.tsx` — panneau back-office monté dans la colonne de droite de `/admin/surveys/[id]/edit`.
- `POST|DELETE /api/surveys/[id]/banner` — upload bucket `survey-banners`, écrit `schema.settings`, nettoie l'ancien fichier, audit log.
- `GET /api/geocode?q=` — proxy Nominatim authentifié (User-Agent conforme, pas de CORS).
- Migration `031_survey_event_banner.sql` — bucket public + policies (idempotente).
- `tests/unit/survey-event.test.ts` — 26 tests.

### Itération 2 (même session)
> "Pour l'adresse et la localisation sur la carte, il faut permettre de déplacer le curseur manuellement. Dans le back-office de création il faut demander s'il s'agit d'un sondage ou d'un événement ; dans le cas d'un événement la section « Habillage et événement » doit être au-dessus de `edit-main`. Il est possible de masquer les étapes pour arriver directement aux questions."

- `src/components/survey/EventLocationPicker.tsx` — clic sur la carte pour poser le point + marqueur **draggable**. Remplace l'aperçu figé dans le panneau back-office ; la recherche d'adresse ne fait que pré-positionner.
- `/admin/surveys/nouveau` — choix **Sondage / Événement** en tête de page. L'événement envoie un `schema` complet (socle d'inscription : nom, email, téléphone, nb de participants) au lieu d'un `template_id` ; `event.enabled`, `start_cta` et `hide_step_intros` sont pré-réglés.
- `/admin/surveys/[id]/edit` — `EventSettingsPanel` bascule de l'aside vers `edit-main` (au-dessus du builder) dès que `settings.event.enabled` est vrai, via la prop `layout="main"` qui adapte aussi la typographie du titre.
- `settings.hide_step_intros` — `buildSlides()` n'émet plus les slides d'intro de section. Case à cocher dans l'en-tête du `SurveyBuilder`.

### Points d'attention
- **`leaflet-icons.ts` ne peut pas être importé statiquement.** Le module appelle Leaflet au chargement → `ReferenceError: window is not defined` au SSR (page blanche + hydratation morte, y compris sur les autres routes tant que le dev server n'est pas redémarré). Toujours l'importer dans l'effet : `await import("@/components/tickets/leaflet-icons")`.
- **Carte : Leaflet, pas d'iframe.** La CSP du projet (`next.config.ts`) autorise les tuiles OSM en `img-src` mais **pas** `openstreetmap.org` en `frame-src` : un embed iframe serait bloqué. Réutiliser `EventMap` / le pattern de `TicketLocationMap`.
- **Dates** : saisies en `datetime-local` (donc sans fuseau) et interprétées dans le fuseau du navigateur. `parseEventDate()` force l'interprétation **locale** des dates seules (`2026-09-12`), sinon le moteur JS les lit en UTC et décale d'un jour.
- **Bannière** : l'API persiste elle-même `schema.settings.banner_url` côté serveur *et* renvoie l'URL au client, qui met à jour son état local — sinon la sauvegarde suivante du builder écraserait la valeur avec un schema périmé.
- Le mode événement ne s'active que si `enabled` **et** `starts_at` sont renseignés (`eventIsConfigured()`).

### Tests
```
npm test  → 77 ✓ (dont 26 nouveaux sur survey-event)
```

---

## Session 9 — Compteurs de réponses et soft-delete (2026-07-22)

### Prompt de départ
> "Dans les tableaux de bord le `data-label="Réponses"` doit être MAJ quand on supprime une réponse, même chose pour les `civiq-card` et `civiq-stat-card`."

### Cause racine
Les réponses sont en **soft-delete** depuis la migration 009 (`responses.deleted_at`). Toutes les listes filtraient bien `.is("deleted_at", null)`, mais **aucun agrégat ne le faisait** : `responses(count)`, `count: "exact"`, la vue `commune_stats` et les fonctions SQL comptaient les lignes en corbeille. Le compteur restait donc figé après une suppression.

### Livrés
- `.is("responses.deleted_at", null)` sur les trois requêtes `responses(count)` (`/api/surveys`, `/admin/dashboard`, `/admin/surveys`) — le filtre porte sur la ressource imbriquée et s'applique **avant** l'agrégat.
- `.is("deleted_at", null)` sur les comptages directs : réponses 30 j, fiche commune super-admin, heatmap analytics.
- Migration `032_stats_exclude_soft_deleted.sql` : vue `commune_stats` (réponses **et** sondages), `platform_activity_by_hour()`, `get_survey_stats()`.
- `SurveysSection` : les compteurs passent de `useState` à `useMemo` dérivé de `surveys` — supprimer un sondage met aussi à jour la ligne de synthèse.
- `router.refresh()` après suppression d'une réponse : les pages serveur (`civiq-stat-card`) ne réaffichent plus l'ancien total depuis le cache du routeur.

### Point d'attention
**Tout nouvel agrégat sur `surveys` ou `responses` doit exclure `deleted_at`.** Le filtre d'une ressource imbriquée s'écrit `.is("responses.deleted_at", null)` au niveau de la requête parente (même pattern que `src/lib/tickets/queries.ts`).

---

## Session 10 — Événements : modèles et saisie du lieu (2026-07-22)

### Prompt de départ
> "En mode événement, quand on saisit une adresse on n'arrive pas à trouver l'adresse, ce n'est pas intuitif. Ajoute des modèles d'événements en formulaire de départ. Quand on crée un sondage, « Habillage & événement » ne doit pas mentionner événement, et le mode inscription à un événement ne doit pas apparaître puisqu'on le sélectionne au départ."

### Livrés
- `src/lib/event-templates.ts` — 6 modèles d'inscription (simple, réunion publique, fête/repas, atelier, sortie/voyage, exposant). En TypeScript et non dans `survey_templates` : communs à toutes les communes, versionnés avec le code, sans seed SQL.
- **Adresse en autocomplétion** dans `EventSettingsPanel` (debounce 450 ms — Nominatim limite à 1 req/s), contexte commune (`code postal + nom`) issu de `/api/auth/me`.
- `/api/geocode` accepte `?lat=&lng=` (**géocodage inverse**) et `?context=`, et renvoie un libellé court (`name, rue, CP ville`) au lieu du `display_name` verbeux. Repli sans contexte si la recherche contextualisée ne renvoie rien.
- **Carte centrée sur la commune** : la commune est géocodée une fois au montage et sert de `defaultCenter` (zoom 14). Le picker n'est monté qu'une fois ce centre résolu — il s'initialise une seule fois et ne se recentre pas ensuite.
- Bascule « Mode inscription à un événement » **supprimée** : le panneau affiche le bloc événement si `settings.event.enabled`, positionné à la création. Titre « Habillage » en colonne latérale (sondage), « Événement & habillage » en colonne principale (événement).

### Points d'attention
- **Un sondage existant ne peut plus devenir un événement depuis l'interface** (le type est figé à la création). Il faudrait éditer `schema.settings.event.enabled` en base — ou rétablir une bascule si le besoin apparaît.
- **Nominatim ne géolocalise pas les noms d'équipements** (« salle des fêtes » + commune → 0 résultat). D'où la séparation nom du lieu / adresse et le placement manuel sur la carte : c'est le chemin nominal, pas un repli.

---

## Session 11 — Accessibilité : mode nuit iOS illisible (2026-07-28)

### Prompt de départ
> "Il y a un problème avec le mode nuit sur iPhone : le fond est bleu et le texte en bleu aussi, du coup on ne voit rien. Vérifie l'accessibilité des couleurs."

### Cause racine
Le mode nuit était **à moitié implémenté** — un hybride cassé :
- Le **boot loader** (`src/app/layout.tsx`) forçait `html, body { background: #042F64 }` (bleu marine) via `@media (prefers-color-scheme: dark)`, et ce fond persistait sur **toute** l'app après l'hydratation.
- Les **tokens applicatifs** restaient en mode clair (`--fg` = bleu marine foncé `oklch(0.13 …)`) : le dark mode `[data-theme="dark"]` n'est **branché nulle part** (aucun toggle, aucun script ne pose l'attribut) et **aucun `color-scheme`** n'était déclaré → iOS assombrissait de son côté les surfaces/contrôles natifs.
- Résultat : **texte bleu marine foncé sur fond bleu marine ⇒ contraste quasi nul, illisible.**

### Décision
L'app est conçue **light-first** et truffée de couleurs claires codées en dur (ex. `SurveyBuilder` : dizaines de `#fff`/`#f0f7ff`). Un dark mode global régresserait la lisibilité de l'admin. Correction retenue : **forcer un schéma clair cohérent** (accessible tout de suite), plutôt que d'activer un dark mode non audité.

### Livrés (commit `77e08e0`)
- `src/app/globals.css` : `color-scheme: light` sur `:root` → iOS rend les contrôles natifs (inputs, selects, scrollbars) en clair même OS en mode nuit. `color-scheme: dark` ajouté sur `[data-theme="dark"]` pour cohérence future.
- `src/app/layout.tsx` : suppression du bloc `@media (prefers-color-scheme: dark)` du boot loader (le fond par défaut `html, body { background: #FFFFFF }` s'applique désormais aussi en mode nuit).

### Vérification (navigateur mobile 375×812, `prefers-color-scheme: dark` actif)
- `color-scheme` = `light`, `bodyBg` = `rgb(255,255,255)`, texte `oklch(0.13 …)` → **contraste ≈ 15:1** (WCAG AAA largement dépassé).
- Page publique du sondage lisible en mode nuit (screenshot).

### Points d'attention
- **Le dark mode reste volontairement désactivé.** Les tokens `[data-theme="dark"]` existent mais ne sont pas câblés ; un commentaire dans `globals.css` signale qu'un **audit des couleurs codées en dur** (admin surtout) est requis avant toute activation via `prefers-color-scheme` ou un toggle.
- **`themeColor` dark (#042F64) est conservé** (couleur de la barre d'adresse iOS uniquement, pas le contenu) — barre marine + page blanche = cohérent et on-brand, pas un problème d'accessibilité.
- **Toute future surface qui réagit à `prefers-color-scheme: dark`** (boot, splash, meta) doit rester cohérente avec les tokens : ne pas repeindre `html/body` en sombre tant que `--fg`/`--bg` restent en clair.

---

## Session 12 — Cohérence du parcours d'inscription + validation super-admin (2026-07-30)

### Prompt de départ
> "Vérifie le parcours lors de l'inscription des utilisateurs avec la validation du super admin, il y a des incohérences." → puis « corrige tout ».

### Incohérences trouvées (audit du flux)
Le workflow cible : `/auth/register` → email/OTP → `resolvePostLoginRedirect` crée un `commune_request` pending → super-admin valide/refuse dans `/super-admin/requests`. Cinq incohérences le contredisaient :

1. **🔴 Parcours legacy contournant la validation.** `/admin/setup` + `POST /api/auth/setup` (Session 2) créaient une commune **et** posaient `role='admin'` directement, sans approbation. L'API restait live (middleware = « authentifié » seulement) → n'importe quel compte pouvait s'auto-promouvoir admin d'une nouvelle commune.
2. **🔴 Le refus ne « tenait » pas.** `resolvePostLoginRedirect` ne testait que l'absence d'une demande **pending** avant d'en recréer une depuis `user_metadata` (où `signup_intent='commune'` est gravé à vie). Après un refus (`rejected`), la connexion suivante réinsérait la demande identique → décision du super-admin annulée.
3. **🟠 Email de décision promis mais jamais envoyé.** `register` et `OnboardingForm` affirmaient « vous recevrez un email dès validation » — aucun envoi n'existe côté approve/reject.
4. **🟠 Parcours « administré » (viewer) orphelin et sans issue.** `/auth/signup` (magic-link, rôle viewer) n'était lié nulle part ; et un viewer sans commune était renvoyé login → dashboard → `/admin/onboarding` (entonnoir commune) sans espace viewer réel.
5. **🟡 Approbation autorisant `viewer`.** Le prompt de `/super-admin/requests` proposait admin/editor/**viewer** → cas « viewer rattaché » non géré ailleurs.

### Livrés
- **#1** — Supprimés `src/app/admin/setup/page.tsx`, `src/app/api/auth/setup/route.ts`. Bypass `isSetup` retiré de `admin/layout.tsx` et `AdminShell.tsx`. Seule porte d'accès admin restante : validation super-admin.
- **#2** — `resolvePostLoginRedirect` (`src/lib/auth-post-login.ts`) : la demande auto n'est créée que si **aucune** demande n'existe (tous statuts confondus, `.limit(1)`), au lieu de « pas de pending ». Un refus n'est plus régénéré ; l'utilisateur re-soumet manuellement depuis `/admin/onboarding`.
- **#3** — Copie corrigée dans `register/page.tsx` et `OnboardingForm.tsx` : « la décision s'affichera à votre prochaine connexion » (plus de promesse d'email).
- **#4** — Supprimé `src/app/auth/signup/page.tsx` (orphelin). Entrée unique : `/auth/register`.
- **#5** — Rôle d'approbation borné à `admin|editor`, côté client (`requests/page.tsx`) **et** serveur (`commune-requests/[id]/route.ts`, clamp `candidateRole → 'admin' | 'editor'` même pour une donnée legacy `requested_role='viewer'`).

### Vérification
- `npx tsc --noEmit` → exit 0 ; `npm test` → 77 ✓ ; aucune référence morte (`admin/setup`, `api/auth/setup`, `auth/signup`, `isSetup`).
- Flux d'auth non exerçable dans le preview sans session Supabase → validation par typecheck + tests.

### Points d'attention
- **Une seule voie pour devenir admin/editor : `commune_request` approuvée.** Ne jamais réintroduire d'écriture directe de `role='admin'` + `commune_id` hors de `/api/super-admin/commune-requests/[id]`.
- **`signup_intent` est immuable** dans `user_metadata` : toute logique post-login qui s'en sert doit se garder contre la réexécution (idempotence via l'état en base, pas via la metadata).
- **Aucun provider email câblé.** Si une notification de décision devient nécessaire, l'ajouter dans l'endpoint approve/reject et rétablir la copie correspondante.
- **Rôle `viewer` = lecteur sans commune.** Il n'a pas d'espace admin ; ne pas le rattacher à une commune via l'approbation.

---

## Session 13 — Emails de décision, ordre d'inscription, modules à l'approbation (2026-07-30)

### Prompt de départ
> "Quand l'utilisateur est confirmé ou refusé par le super admin, il reçoit un mail charté avec le logo GoCiviq et les coordonnées de la mairie quand une mairie a été sélectionnée. Lors de l'inscription l'utilisateur doit voir en premier « se rattacher à une commune ». Lors de la demande de rattachement que le super admin valide, le super admin sélectionne les modules à activer pour le compte."

### Livrés
1. **Ordre d'inscription** — `/auth/register` : l'option « Me rattacher à une commune existante » est désormais **première et sélectionnée par défaut** (`choice` init `"join"`). L'onboarding avait déjà `join` par défaut.
2. **Emails transactionnels de décision** (approbation / refus)
   - `src/lib/email.ts` — `sendEmail()` via l'**API REST Resend** (pas de SDK, zéro dépendance npm, pas de churn de lockfile). **Gracieux** : si `RESEND_API_KEY`/`EMAIL_FROM` manquent → log + `{ sent: false }`, **jamais de throw** (une décision ne doit jamais échouer à cause d'un email). Helper `getSiteUrl()` (env → `VERCEL_URL` → prod).
   - `src/lib/emails/commune-decision.ts` — reprend **à l'identique la charte du template d'auth Supabase** (`supabase/templates/magic-link.html`) : fond `#f5f7fb`, carte blanche arrondie 560px (`border #e6eaf2`, radius 18), **logo horizontal SVG** `brand/logo-horizontal.svg` centré, eyebrow bleu `#2f6fdb` majuscule, titre navy `#042f64`, **bouton pill navy**, bandeau footer `#f9fafc`, baseline « GoCiviq - Plate-forme citoyenne… ». L'email d'approbation inclut un **bloc coordonnées mairie** (nom, CP, email, téléphone, site) ; le refus inclut le motif. → cohérence visuelle totale avec l'email de lien magique.
   - Câblage dans `POST /api/super-admin/commune-requests/[id]` : après succès BDD, envoi best-effort (`getRecipient()` lit l'email via `auth.admin.getUserById` + le nom via `profiles`).
3. **Sélection des modules à l'approbation**
   - L'endpoint approve accepte `modules: string[]` → filtre sur `modules.is_available` → upsert `commune_modules` (PK `(commune_id, module_id)`, `onConflict`).
   - `/super-admin/requests` : le `window.prompt` de rôle est remplacé par une **modale** (rôle admin/editor + cases à cocher des modules, catalogue via `/api/super-admin/modules`, présélection `surveys`).

### Configuration requise (Vercel → Environment Variables)
Pour que les emails partent réellement :
```
RESEND_API_KEY = re_xxx
EMAIL_FROM     = "GoCiviq <no-reply@votredomaine.fr>"   # domaine vérifié dans Resend
NEXT_PUBLIC_SITE_URL = https://votre-app.vercel.app      # liens + logo des emails
```
Sans ces variables, tout le flux fonctionne **sauf** l'envoi d'email (dégradation silencieuse, la décision reste consultable à la reconnexion).

### Vérification
- `npx tsc --noEmit` → exit 0 ; `npm test` → 77 ✓.
- Rendu des deux emails généré et contrôlé (logo, couleurs marine/or, coordonnées mairie, CTA) — aperçus envoyés à l'utilisateur.

### Points d'attention
- **Provider email = Resend via REST.** Pour changer de provider, ne modifier que `src/lib/email.ts` (l'appelant est agnostique). Le domaine `EMAIL_FROM` doit être vérifié côté Resend, sinon 4xx.
- **Charte email = celle de `supabase/templates/magic-link.html`.** Toute évolution du look des emails de décision doit rester alignée sur ce template (logo horizontal SVG, eyebrow bleu, titre navy, bouton pill, footer). Le logo dépend de `NEXT_PUBLIC_SITE_URL` — sans elle, fallback `https://gociviq.fr`.
- **Copie register/onboarding remet la promesse email** (Session 12 l'avait retirée) : cohérent seulement une fois Resend configuré.
- **Activation modules à l'approbation ≠ exclusive** : upsert idempotent, complémentaire du toggle depuis `/super-admin/communes/[id]`.

---

## Session 14 — Coordonnées mairie (email refus, édition super-admin, saisie à la création) + vérif modules (2026-07-30)

### Prompt de départ
> "Dans le mail rejection il faut aussi ajouter les coordonnées de la mairie. Ces informations sont toujours saisissables/modifiables par le super admin dans la route communes/ — on peut aussi les saisir lors de la création d'une commune dans le formulaire d'inscription. Sélection des modules à la validation → il faut que cela marche pour l'utilisateur, vérifie bien."

### Cause racine découverte
`communes` **n'avait pas de colonne `phone`** (le `phone` de la migration 012 est sur `profiles`). Le code d'approbation/PATCH aurait planté à l'exécution. → **Migration 033** ajoute `communes.phone`.

### Livrés
1. **Email de refus enrichi** — `buildRejectionEmail` accepte `commune: CommuneContact`. L'endpoint reject récupère les coordonnées de la commune visée (cas `join`) et les joint (même bloc que l'approbation). Cas `create` : pas de commune → seul le nom proposé apparaît dans le texte.
2. **Édition des coordonnées par le super-admin** (`/super-admin/communes/[id]`)
   - `PATCH /api/super-admin/communes/[id]` accepte désormais `phone` + `website_url` (en plus de name/code_postal/contact_email), trim → null, et refuse un nom vide.
   - Nouvelle section « Coordonnées de la mairie » avec formulaire éditable (nom, CP, téléphone, email, site) + bouton Modifier/Enregistrer. La note rappelle que ces infos figurent dans les emails.
3. **Saisie à la création** (formulaire d'inscription + onboarding)
   - **Migration 033** : `commune_requests.proposed_phone` + `proposed_website`.
   - `/auth/register` (onglet créer) : champs Email officiel + Téléphone + Site web → `user_metadata` (`create_commune_email/phone/website`).
   - `resolvePostLoginRedirect` : reporte ces métadonnées dans le `commune_request` auto-créé (`proposed_email/phone/website`).
   - `/admin/onboarding` (onglet créer) : ajout Téléphone + Site web (email déjà présent) → `POST /api/commune-requests` (qui accepte `proposed_phone/proposed_website`).
   - **Approbation** : la commune est créée avec `phone` + `website_url` (email déjà repris via `proposed_email`). Le super-admin peut ensuite tout modifier.
4. **Flux modules vérifié de bout en bout**
   - Approbation upsert `commune_modules` (PK `(commune_id, module_id)`, filtre `is_available`).
   - `admin/layout.tsx` (AdminShell) recalcule les modules effectifs du user (editor/admin) depuis `commune_modules` moins les overrides → passe les clés à `NAV_GROUPS` (ids `surveys`/`tickets`/`projects`). Page `force-dynamic` → visible dès la navigation suivante. **OK**.

### Vérification
- `npx tsc --noEmit` → exit 0 ; `npm test` → 77 ✓.
- Aperçus emails régénérés (approbation + refus avec coordonnées) envoyés à l'utilisateur.

### Points d'attention
- **⚠ Migration 033 à appliquer dans Supabase avant de tester** : sans `communes.phone`, l'approbation d'une demande `create` (insert avec `phone`) et le PATCH des coordonnées **échouent**. Les colonnes `proposed_phone/proposed_website` sont également requises pour la saisie à la création.
- **`website_url` / `contact_email` existent depuis la migration 001** ; seule `phone` manquait sur `communes`.
- **Modules « catalogue sans UI »** (`budget`, `events`, `alerts`, `urbanism`) restent sélectionnables à l'approbation mais n'ajoutent aucune navigation (pas d'implémentation) — cohérent avec le toggle de la fiche commune.
