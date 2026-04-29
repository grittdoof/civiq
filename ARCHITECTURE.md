# Architecture CiviQ

> État au 2026-04-23. Complète [CLAUDE.md](./CLAUDE.md) (historique) et [GUIDE_DEBUTANT.md](./GUIDE_DEBUTANT.md) (tutoriel).

---

## Vue d'ensemble

CiviQ est une **plateforme SaaS multi-tenant et modulaire** destinée aux communes. Chaque commune possède son espace isolé, active les modules qu'elle souhaite (sondages, budget participatif, événements…) et invite ses agents à y collaborer.

```
┌──────────────────────────────────────────────────────────┐
│  Navigateur                                              │
│  ├── /               Landing                             │
│  ├── /auth/*         Inscription / connexion / reset     │
│  ├── /survey/:slug   Formulaire public (citoyens)        │
│  ├── /admin/*        Espace commune (éditeurs/admins)    │
│  └── /super-admin/*  Console plateforme (super-admin)    │
└──────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router) — sur Vercel                    │
│  ├── Server Components     (fetch direct BDD)            │
│  ├── Route Handlers /api/* (API REST + service role)     │
│  ├── Middleware            (cookies Supabase)            │
│  └── Registre de modules   (src/modules)                 │
└──────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│  Supabase                                                │
│  ├── PostgreSQL + RLS  (isolation par commune_id)        │
│  ├── Auth              (email/password, magic link)      │
│  └── Storage           (logos de communes, à venir)      │
└──────────────────────────────────────────────────────────┘
```

---

## Stack technique

| Couche | Technologie | Pourquoi |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Components + Route Handlers unifiés |
| Langage | TypeScript | Types partagés client/serveur |
| UI | React 19 + Framer Motion + lucide-react | Standard moderne, DX simple |
| Styles | CSS variables + classes utilitaires civiq-* | Design system cohérent, dark mode |
| BDD | PostgreSQL (via Supabase) | RLS natif, JSONB pour les sondages |
| Auth | Supabase Auth | Email/password + magic link out of the box |
| Hosting | Vercel | Intégration Next.js native |

---

## Rôles & permissions

| Rôle | Scope | Capacités |
|---|---|---|
| `super_admin` | Plateforme | Gère toutes les communes, active les modules au catalogue, promeut des users |
| `admin` | Sa commune | Gère membres, active modules pour sa commune, invite, édite paramètres |
| `editor` | Sa commune (modules actifs) | Crée, édite, publie, supprime dans les modules activés |
| `viewer` | Public | Compte simple lecteur (réservé pour features futures) |

L'isolation est assurée par :
- `commune_id` sur chaque table métier
- Policies RLS utilisant `my_commune_id()` et `my_role()` (fonctions `SECURITY DEFINER` non récursives)
- Les API routes sensibles passent par `createServiceClient()` (bypass RLS)

---

## Modularité

### Principe

La plateforme est composée de **modules indépendants** qu'une commune peut activer à la carte. Le module `surveys` est activé par défaut ; les autres (`budget`, `events`, `alerts`, `urbanism`) sont au catalogue et peuvent être activés depuis la console super-admin.

### Trois niveaux d'isolation

#### 1. Données (Supabase)

```sql
public.modules            -- catalogue plateforme (id, nom, icône…)
public.commune_modules    -- activation par commune
public.my_active_modules()-- fonction : retourne les ids activés pour l'user courant
```

#### 2. Autorisation (server)

[src/lib/module-guard.ts](src/lib/module-guard.ts) expose `requireModule(key)` — utilisable dans toute Route Handler :

```ts
export async function GET() {
  const guard = await requireModule("surveys");
  if (!guard.ok) return guard.response;
  // … suite de la logique, on sait que le module est actif
}
```

Et `isModuleActive(key)` pour les Server Components.

#### 3. Code (registre)

```
src/modules/
├── types.ts        ModuleDefinition + ModuleNavItem
├── registry.ts     MODULES[] + helpers
├── surveys/
│   └── index.ts    définition du module surveys
├── budget/
├── events/
├── alerts/
└── urbanism/
```

Chaque `index.ts` exporte une `ModuleDefinition` :

```ts
{
  key: "surveys",
  name: "Sondages citoyens",
  icon: ClipboardList,
  status: "stable",
  adminNav: [{ href: "/admin/dashboard", label: "…", icon: … }],
  ownedPaths: ["/admin/surveys", "/api/surveys", …],
}
```

Le registre `registry.ts` fournit :

- `MODULES` — liste complète
- `MODULES_BY_KEY` — lookup O(1)
- `getActiveModules(keys)` — filtre par clés activées
- `getAdminNavForModules(keys)` — aplati les nav items
- `findModuleForPath(pathname)` — remonte du chemin au module

L'admin layout consomme `getAdminNavForModules()` et construit dynamiquement la sidebar selon les modules activés pour la commune courante.

### Ajouter un nouveau module

Voir la section correspondante dans [GUIDE_DEBUTANT.md](./GUIDE_DEBUTANT.md).

---

## Structure du repo

```
civiq/
├── src/
│   ├── app/                       Routes Next.js
│   │   ├── api/                   Route Handlers
│   │   │   ├── auth/me            Profil + modules actifs
│   │   │   ├── surveys/           CRUD sondages
│   │   │   ├── responses/         Soumission publique
│   │   │   ├── modules/activate   Activation par commune
│   │   │   └── super-admin/       APIs réservées super-admin
│   │   ├── admin/                 Espace commune (layout + pages)
│   │   ├── super-admin/           Console plateforme
│   │   ├── survey/[slug]/         Formulaire public
│   │   ├── auth/                  Login / register / reset / callback
│   │   ├── globals.css            Design system
│   │   └── layout.tsx             Root layout
│   │
│   ├── components/
│   │   └── survey/                SurveyRenderer + SurveyBuilder
│   │
│   ├── modules/                   ← Registre plug-and-play
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   └── {surveys,budget,events,alerts,urbanism}/
│   │
│   ├── lib/
│   │   ├── supabase-server.ts     createClient + createServiceClient
│   │   ├── supabase-browser.ts
│   │   ├── auth-helpers.ts        getAuthContext, isSuperAdmin…
│   │   └── module-guard.ts        requireModule, isModuleActive
│   │
│   └── types/survey.ts            Types métier partagés
│
├── supabase/migrations/           SQL versionné
├── public/                        Assets statiques
├── CLAUDE.md                      Historique de dev
├── ARCHITECTURE.md                ← Ce fichier
├── GUIDE_DEBUTANT.md              Tutoriel
├── CHANGELOG.md                   Log user-facing
└── ROADMAP.md                     Feuille de route
```

---

## Flux clés

### Inscription d'une nouvelle commune

```
/auth/register
  ↓ signUp(email, password)  → email de confirmation Supabase
  ↓ clic sur le lien
/auth/callback
  ↓ exchangeCodeForSession()
  ↓ profile.commune_id manquant → redirect
/admin/setup
  ↓ formulaire (nom commune, couleurs, code postal)
  ↓ POST /api/auth/setup (service role)
  ↓ crée commune + profile + active module 'surveys'
/admin/dashboard
```

### Soumission d'un sondage public

```
/survey/:slug (Server Component)
  → fetch survey + commune (supabase-server)
  → rend SurveyRenderer (Client)
    ↓ soumission formulaire
  → POST /api/responses
    → anti-doublon par IP
    → insert responses avec duration_seconds
  → écran "Merci"
```

### Appel d'une route gated par un module

```
Client                        Route Handler                 Supabase
  │                                │                           │
  │── GET /api/budget/projects ────▶                           │
  │                                │── requireModule("budget")─▶
  │                                │◀── module actif ? OK/403 ─│
  │                                │                           │
  │                                │── select(…) ──────────────▶
  │                                │◀── data ───────────────────│
  │◀── 200 json ───────────────────│                           │
```

---

## Points de vigilance

1. **`createServiceClient` obligatoire pour lire `profiles`** — les policies RLS historiques sont complexes, le service role contourne tout.
2. **Slugs normalisés** — `slugify()` dans `src/app/api/surveys/route.ts` (strip accents, collapse tirets).
3. **Migrations idempotentes** — toujours `create or replace`, `drop policy if exists`, `on conflict do nothing`.
4. **Super-admin bypass** — le guard `requireModule` considère les super-admins comme ayant accès à tout.

---

## À venir (roadmap technique)

- Module registry côté super-admin : UI de config par module (settings jsonb dans `commune_modules`)
- Middleware global qui utilise `findModuleForPath()` pour gater automatiquement les routes sans décoration manuelle
- Déplacer progressivement le code de `src/app/admin/surveys/**` vers `src/modules/surveys/admin/**` (reste à arbitrer vs. contraintes Next.js App Router)
- Storage Supabase pour logos de communes
- Notifications email (Resend) sur soumission de sondage
