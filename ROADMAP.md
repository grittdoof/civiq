# Feuille de route CiviQ

> Vision : plateforme SaaS multi-tenant revendable à n'importe quelle mairie française.
> Chaque commune active les modules dont elle a besoin, invite ses agents/adjoints, et gère son espace en autonomie.
> Le Super Administrateur gère la plateforme entière (catalogue de modules, communes, stats globales).

---

## 📌 Où on en est — Avril 2026

### ✅ Socle livré
- [x] Stack complète : Next.js 15 + Supabase + Vercel
- [x] Multi-tenant strict avec isolation `commune_id` + RLS
- [x] Auth email/password + magic link + reset
- [x] Pages légales (mentions-legales, confidentialité)
- [x] Onboarding commune (`/admin/setup`)
- [x] **Module Sondages complet** : création, édition visuelle (SurveyBuilder 11 types), publication, résultats graphiques, export CSV, suppression
- [x] **Super Administrateur** : dashboard + pages communes/utilisateurs
- [x] **Système de modules** (catalogue + activation par commune)
- [x] **Multi-admin par commune** (invitations par token email)
- [x] **Design system Airbnb** (coral, cards, shadows douces)
- [x] Helper d'auth centralisé (`auth-helpers.ts`)

### 🚧 En cours
- [ ] Page super-admin **Modules** (catalogue + activations)
- [ ] Layout `/admin` dynamique basé sur les modules activés
- [ ] Page `/admin/team` (membres + invitations)
- [ ] Page `/admin/modules` (catalogue commune + activer/désactiver)
- [ ] Page `/auth/invitation/[token]` (preview + accept)
- [ ] Refonte `/admin/dashboard` avec design Airbnb complet

---

## 🎯 Rôles et permissions

```
┌──────────────────────────────────────────────────────────────────┐
│ SUPER ADMINISTRATEUR  (role = 'super_admin')                     │
│   Scope : plateforme entière                                      │
│   • Gère le catalogue de modules (disponibles / beta / masqués)  │
│   • Voit toutes les communes et toutes les stats                 │
│   • Peut promouvoir / rétrograder n'importe quel utilisateur     │
│   • Active/désactive des modules pour n'importe quelle commune   │
│   • Definit les paliers admin/editor/viewer par commune (futur)  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ADMINISTRATEUR  (role = 'admin')                                 │
│   Scope : sa commune                                              │
│   • Gère les membres de sa mairie (invite, retire)               │
│   • Active/désactive les modules que le super-admin a autorisés  │
│   • Edite les paramètres de la commune (nom, couleurs, contact)  │
│   • Toutes les permissions d'éditeur                             │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ÉDITEUR  (role = 'editor')                                       │
│   Typiquement : agent territorial, adjoint, conseiller municipal │
│   Scope : sa commune — modules activés                            │
│   • Crée, édite, publie, ferme, supprime dans chaque module actif│
│   • Voit les résultats et exporte en CSV                         │
│   • Ne peut pas activer de modules ni inviter de membres         │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ADMINISTRÉ  (role = 'viewer')  — rôle par défaut                 │
│   Scope : public                                                  │
│   • Crée un compte simple (lecteur)                              │
│   • Pas d'accès à /admin/* ni /super-admin/*                     │
│   • Pas d'accès aux modules                                       │
│   • Rôle réservé pour features futures (suivi d'inscription aux  │
│     événements, historique de participation aux sondages, etc.)  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📦 Modules — catalogue et roadmap

### ✅ Sondages citoyens (`surveys`) — livré, actif partout
- [x] SurveyBuilder avec 11 types (text, email, tel, textarea, select, radio, checkbox, checkbox_grid, scale, date, number)
- [x] Champs conditionnels
- [x] Publication + lien public avec branding commune
- [x] Résultats graphiques (Recharts)
- [x] Export CSV UTF-8 BOM
- [x] Suppression
- [ ] Duplication d'un sondage
- [ ] Duplication d'un template partagé entre communes
- [ ] Programmation d'ouverture (`starts_at`)
- [ ] Notifications email aux répondants
- [ ] Rapport PDF automatique

### 🏗 Budget participatif (`budget`) — catalogue, pas encore implémenté
- [ ] Proposer un projet (titre, description, photos, estimation)
- [ ] Phase de vote (1 voix ou N voix par citoyen)
- [ ] Seuil de budget par projet
- [ ] Cartographie des projets
- [ ] Suivi des dépenses post-vote

### 📅 Événements municipaux (`events`) — catalogue
- [ ] Création d'un événement (date, lieu, description)
- [ ] Inscription en ligne (capacité max)
- [ ] QR code de billet
- [ ] Liste des inscrits + export
- [ ] Rappels email

### 🔔 Alertes citoyens (`alerts`) — catalogue
- [ ] Diffusion rapide (météo, sécurité, travaux)
- [ ] Canaux : push, SMS, email
- [ ] Segmentation par quartier / abonnement
- [ ] Historique des alertes envoyées

### 🏗 Concertations urbanisme (`urbanism`) — catalogue
- [ ] Présentation d'un projet d'aménagement (cartes, photos, plans)
- [ ] Recueil de contributions (texte libre + géolocalisation)
- [ ] Phases de concertation successives
- [ ] Synthèse publique des contributions

---

## 🛠 Plan de développement par phase

### Phase 1 — Finir le socle super-admin (en cours)
1. **Page super-admin Modules** — Table des modules avec toggle `is_available` / `is_beta` + compteur d'activations
2. **Layout `/admin` dynamique** — Navigation générée depuis `modules` de `/api/auth/me`
3. **Page `/admin/team`** — Lister membres, inviter (formulaire + email + copie du lien), lister invitations en attente, révoquer
4. **Page `/admin/modules`** — Catalogue côté commune, toggle d'activation (admin uniquement)
5. **Page `/auth/invitation/[token]`** — Preview de l'invitation + bouton Accepter (si connecté avec le bon email)

### Phase 2 — Finitions UX sondages
1. **Duplication** de sondages
2. **Marketplace de templates** entre communes
3. **Programmation d'ouverture** (auto-publication à une date)
4. **Rapport PDF** automatique des résultats

### Phase 3 — Module Budget participatif
1. Schéma BDD (`proposals`, `votes`, `budget_rounds`)
2. Interface citoyen : proposer + voter
3. Interface admin : modérer, clôturer un round, publier les gagnants
4. Dashboard de suivi post-vote

### Phase 4 — Module Événements + Alertes
1. Événements : CRUD, inscriptions, QR code
2. Alertes : intégration Twilio (SMS) + VAPID (push) + provider email

### Phase 5 — Module Urbanisme + rôle « Administré »
1. Urbanisme : cartes Mapbox/Leaflet, recueil géolocalisé
2. Espace `/mon-compte` pour les `viewer` : historique de leurs participations, notifications, gestion des préférences

### Phase 6 — Industrialisation SaaS
1. **Facturation** par commune (Stripe) — tarification par module actif ou bundle
2. **Onboarding auto** : route publique `/commune/nouvelle` → création de compte + commune + sélection modules + paiement
3. **White-label** avancé : sous-domaine par commune (`chateauneuf.civiq.fr`) ou domaine custom
4. **Monitoring** : Sentry, Posthog, dashboards Supabase
5. **Conformité** : DPIA, registre RGPD automatique, export RGPD (article 20)

---

## ⚠️ Dette technique et points d'attention

### À revoir
- **Auth super-admin** : la garde est côté client uniquement (`useEffect` → redirect). Ajouter un middleware Next.js qui bloque `/super-admin/*` côté serveur.
- **Invitations** : `profiles.upsert` écrase un `commune_id` existant si un utilisateur accepte une invitation d'une autre commune → à remplacer par un modèle many-to-many (`commune_memberships`) ou un refus explicite.
- **Dernière défense super-admin** : empêcher qu'un super-admin puisse se rétrograder lui-même si c'est le dernier compte super-admin.
- **Rate limiting** : aucun sur les tentatives de token d'invitation ni sur login. À ajouter (Vercel Edge Config ou Upstash).

### À améliorer
- **Tests** : zéro test unitaire ou E2E pour l'instant. Ajouter Vitest + Playwright.
- **Migrations** : basculer sur `supabase db push` géré (CI/CD) plutôt que copier-coller SQL editor.
- **Logs API** : centraliser avec un middleware + Sentry.

---

## 📍 Dépôt et environnements

- **Dépôt Git** : [`grittdoof/civiq`](https://github.com/grittdoof/civiq) branche `main`
- **Prod** : non déployée (Vercel)
- **Staging** : non déployé
- **Dev local** : `npm run dev` + Supabase project lié via `.env.local`

---

## 🔄 Suivi par session Claude

Voir [CLAUDE.md](./CLAUDE.md) pour l'historique détaillé du développement par session, les décisions d'architecture, et les problèmes rencontrés + solutions.

Voir [CHANGELOG.md](./CHANGELOG.md) pour le journal utilisateur des modifications, versionné par date.
