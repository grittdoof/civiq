# Changelog CiviQ

Toutes les modifications notables sont documentées ici, par date, de la plus récente à la plus ancienne.

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

---

## [2026-06-07] — Module « Gestion de projet » (beta)

### Ajouté
- **Nouveau module `projects`** au catalogue (réservé élus/agents, comme tickets). Pilotage complet des projets d'investissement de la commune sur leur cycle de vie standard en **7 étapes** : Émergence → Faisabilité → Décision & budget → Recherche de financement → Conception & marchés → Réalisation → Bilan & clôture.
- **Machine à états serveur** (RPC `advance_project_phase`) :
  - Recul d'étape autorisé mais commentaire obligatoire.
  - Saut d'étape interdit sauf forçage admin avec commentaire.
  - **Porte de financement** : passage en réalisation bloqué tant qu'aucune subvention n'a un statut `ar_recu` / `accordee` / `soldee` ET que `sans_subvention` n'est pas explicitement coché. Règle non contournable même par forçage admin.
  - **Bilan obligatoire** avant clôture : coût réel + explication de l'écart.
  - Journal de transitions complet (`project_phase_log`).
- **Coûts d'exploitation sur 10 ans** avec calcul du coût global **nominal** et **actualisé** (formules d'actualisation classiques). Taux d'inflation / actualisation paramétrables par commune (`commune_settings`) avec override possible par projet.
- **Parties prenantes en logique RACI** (décide / finance / exécute / consulté / informé) avec étape d'intervention. Annuaire commune réutilisable.
- **Plan de financement** : suggestions DETR / DSIL / Département / Région / Europe, statuts complets, notifications sur accordée/refusée.
- **Jalons** par phase avec échéances + alertes en retard.
- **Vue kanban des 7 phases** + bandeau de synthèse financière consolidée (investissement total, subventions, reste à charge commune, coût global actualisé cumulé).
- **Vue comparative** triable par coût global actualisé + graphique barres invest vs actualisé.
- **Cartographie des parties prenantes** filtrable par type et rôle.
- **Revue mensuelle** imprimable (alertes et prochaines échéances).
- **Export PDF de fiche projet** (2 pages : identité + financement + calendrier, puis coûts 10 ans en avant-plan + parties prenantes + bilan).
- **Lien tickets ↔ projets** : bouton « Transformer en projet » sur la page ticket, lien retour sur la fiche projet (`source_ticket_id`).
- **Notifications push PWA** sur tous les événements majeurs : changement d'étape, jalons, subventions, transformation ticket→projet, séances de commission, validation de compte rendu.
- **Commissions municipales** (sous-module) :
  - Membres avec rôle président/membre.
  - Projets rattachés (un projet peut être suivi par plusieurs commissions).
  - **Séances** : planification + convocation push automatique aux membres + rappel J-1, quorum affiché, ordre du jour.
  - **Émargement électronique** : signature tactile horodatée (canvas → PNG base64) avec PDF d'émargement signé.
  - **Compte rendu** : édition par le secrétaire de séance, cycle brouillon → validé → verrouillé, PDF officiel, notification aux membres à la validation.
  - **Relevé de décisions** : type décision/avis/action ; les actions liées à un projet créent automatiquement un jalon (trigger SQL).

### Sécurité
- 16 nouvelles tables, toutes avec **Row Level Security** stricte basée sur `commune_id` + restriction de rôle (`admin`, `editor`, `super_admin` uniquement — pas de viewer/citoyen).
- Machine à états entièrement vérifiée côté serveur (RPC + tests purs JS).

### Tests
- **47 tests Vitest** sur la logique métier critique (state-machine + calcul de coût global). Tous verts.

---

## [2026-04-20] — Profil + suppression sondage + CSS

### Ajouté
- **Page « Profil & paramètres »** — Nouveau bloc « Statut du compte » en haut de page avec icône, libellé et description du rôle (Super Administrateur, Administrateur, Éditeur, Administré)
- **Module Sondage** — Bouton de suppression dans le dashboard, avec confirmation native et mise à jour optimiste de la liste
- **Documentation** — CHANGELOG.md (ce fichier) + ROADMAP.md à la racine

### Modifié
- `DELETE /api/surveys/[id]` — Les éditeurs peuvent maintenant supprimer un sondage (avant : admin + super_admin uniquement)
- CSS `.civiq-field-label` — `display: block`, `font-size: 15px`, `font-weight: 600`, `color: var(--bleu-nuit)`, `margin-bottom: 8px`
- CSS `.civiq-btn` — Texte blanc par défaut (les variants `secondary` et `ghost` continuent à override)
- Nouvelle variable CSS `--bleu-nuit: #1a2744` (alias sémantique de `--civiq-primary`)

---

## [2026-04-20] — Super-admin, modules, multi-admin, design Airbnb

Commit `51a1dfb` sur `main`

### Ajouté
- **Mode Super Administrateur** — Espace `/super-admin/*` avec sidebar dédiée (dark) pour gérer la plateforme entière
  - Tableau de bord : stats globales (communes actives, utilisateurs, sondages, réponses) + grille des communes
  - Page Communes : table searchable avec stats par commune
  - Page Utilisateurs : éditer les rôles en ligne, badges couleur par rôle
- **Système de modules** — Architecture catalogue + activation par commune
  - Table `modules` : 5 modules seed (Sondages, Budget participatif, Événements, Alertes, Urbanisme)
  - Table `commune_modules` : activation à la carte par commune (avec `settings` jsonb)
  - API super-admin pour toggle `is_available` / `is_beta` par module
- **Multi-admin par commune** — Système d'invitations par email
  - Table `commune_invitations` avec token + expiration 7 jours
  - API pour inviter / lister / révoquer / accepter
  - Guard d'email : l'invitation doit matcher l'email du compte accepteur
- **Helper `auth-helpers.ts`** — Contrôle d'accès centralisé : `getAuthContext()`, `isSuperAdmin()`, `isCommuneAdmin()`
- **API** — 7 nouvelles routes (`/api/super-admin/*`, `/api/team/*`, `/api/modules/activate`, `/api/invitations/accept`)
- **Design system Airbnb** — Refonte complète de `globals.css`
  - Coral signature `#ff5a5f`
  - Radius généreux (12–24px)
  - Shadows douces
  - Cards blanches avec borders subtiles
  - Pill badges

### Corrigé
- **Création de sondage** — Import manquant de `createServiceClient` dans `/api/surveys/route.ts` → 500 silencieuse → erreur « Unexpected end of JSON input » côté client
- **Slug de sondage** — Nouveau `slugify()` qui strip les accents et collapse les tirets multiples (avant : `besoins-priscolaires--extrascolaires` pour « Besoins périscolaires & extrascolaires »)
- **Lien public d'un sondage en draft** — Au lieu d'un `404` sec, message « Sondage non encore publié » avec le statut
- **Dashboard admin** — Lien public `/survey/<slug>` affiché et copiable pour tous les statuts (plus seulement publié)
- **Sidebar admin** — Retrait du lien hardcodé `👁 Voir le sondage en ligne` qui pointait vers un slug fictif

---

## [2026-04-19] — Fix RLS récursif

Commit `a2cc335` sur `main`

### Corrigé
- **Erreur « Permissions insuffisantes »** — Les policies RLS étaient récursives : toute subquery sur `profiles` retriggait la policy SELECT de `profiles`, ce qui provoquait une boucle → `NULL` → accès refusé
- Migration `002_fix_rls_policies.sql` :
  - Nouvelles fonctions `SECURITY DEFINER` : `public.my_commune_id()`, `public.my_role()`
  - Toutes les policies réécrites pour utiliser ces fonctions
  - Policy directe « Users can view own profile »
- Toutes les API sensibles lisent maintenant `profiles` via le service role (bypass RLS complet)
- Nouvelle route `/api/auth/me` centralisée

---

## [2026-04-19] — Bugs dashboard, sondage, paramètres

Commit `a4d1efb` sur `main`

### Corrigé
- **Dashboard bloqué sur « Chargement… »** — `setLoading(false)` jamais appelé si la query échouait → wrap en try/finally partout
- **Création de sondage silencieuse** — Pas de feedback d'erreur, mauvaise redirection → `createError` state + redirect vers `/edit` au lieu de `/results`
- **Paramètres de commune cassés** — Même pattern try/finally sur `/admin/profile`

---

## [2026-04-19] — Pages légales + premier push GitHub

Commits `1810b16` + `2c78631` sur `main`

### Ajouté
- `/mentions-legales` — 7 sections conformes à l'usage FR
- `/confidentialite` — Politique RGPD avec tableau des finalités
- Lien « Mot de passe oublié » dans `/auth/login`
- Premier push sur `grittdoof/civiq`

---

## [2026-04-18] — Session 2 : Corrections et complétude

### Ajouté
- `/auth/register` — Inscription email/password
- `/auth/reset-password` — Réinitialisation de mot de passe
- `/admin/setup` — Configuration de la commune après inscription
- `/api/auth/setup` — API service-role pour créer commune + profil
- `/demo/periscolaire` — Démo interactive sans sauvegarde
- **SurveyBuilder** — Éditeur visuel complet du schema JSON
- **Page édition** `/admin/surveys/[id]/edit` — Split builder + paramètres
- **Types manquants dans SurveyRenderer** : `date`, `number`
- `PATCH` et `DELETE /api/surveys/[id]`

### Modifié
- Suppression des dépendances inutilisées (`zustand`, `react-hook-form`, `@hookform/resolvers`, `zod`)
- Suppression des `as any` dans dashboard et survey/[slug]

---

## [2026-04-18] — Session 1 : Fondations

### Ajouté
- Stack initial : Next.js 15 (App Router) + Supabase + Vercel
- Migration `001_initial_schema.sql` : communes, profiles, surveys, responses, survey_templates + RLS
- `SurveyRenderer` — Moteur de rendu multi-étapes (11 types de questions)
- Pages publiques `/survey/[slug]` avec branding par commune
- Admin : dashboard, new survey, results (avec Recharts)
- Export CSV UTF-8 BOM
- Auth email/password + magic link
- Landing page marketing
