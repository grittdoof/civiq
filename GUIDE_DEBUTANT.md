# Guide du débutant — CiviQ

> Tu viens d'arriver sur le projet ? Ce guide te fait entrer dans l'app en 30 min.
> Pour le détail des couches, lis [ARCHITECTURE.md](./ARCHITECTURE.md) ensuite.

---

## 1. Installer et lancer

```bash
git clone <repo>
cd civiq
npm install
cp .env.example .env.local    # remplir les 3 clés Supabase
npm run dev                   # http://localhost:3000
```

Les 3 clés à renseigner :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=…   # public, côté navigateur
SUPABASE_SERVICE_ROLE_KEY=…       # secret, côté serveur uniquement
```

Appliquer les migrations SQL dans l'ordre (via l'UI Supabase ou la CLI) :
`supabase/migrations/001` → `004`.

---

## 2. Comprendre le projet en 5 concepts

### ① Multi-tenant = cloisonné par commune

Chaque mairie a son `commune_id`. **Toute donnée métier** (sondage, réponse, utilisateur…) porte ce `commune_id` et Postgres Row Level Security empêche une commune de voir les données d'une autre.

### ② Trois types d'utilisateurs

- **super_admin** → toi/l'éditeur de la plateforme. Active les modules pour chaque commune.
- **admin** → le maire ou DGS. Gère son espace.
- **editor** → un agent. Crée/édite les contenus.

### ③ Modules plug-and-play

CiviQ = un **noyau** (auth, multi-tenant, design system) + des **modules activables** :

| Module | Statut | Ce qu'il fait |
|---|---|---|
| `surveys` | stable | sondages citoyens |
| `budget` | beta | budget participatif |
| `events` | coming_soon | inscriptions événements |
| `alerts` | coming_soon | alertes citoyennes |
| `urbanism` | coming_soon | consultations urbanisme |

Un module désactivé = invisible dans la sidebar + 403 si on tape l'URL.

### ④ Server Components par défaut

Dans `src/app/**`, un fichier est **serveur** sauf s'il déclare `"use client"` en tête. Les Server Components peuvent directement `await createClient()` et requêter Supabase sans passer par une API route.

### ⑤ Deux clients Supabase

- `createClient()` → respecte RLS. À utiliser 99% du temps.
- `createServiceClient()` → bypass RLS (secret). Uniquement dans les Route Handlers, typiquement pour lire `profiles` (RLS récursive historique).

---

## 3. Les fichiers à connaître

Si tu ne devais lire que 10 fichiers :

| Fichier | Rôle |
|---|---|
| [src/modules/types.ts](src/modules/types.ts) | Contrat d'un module |
| [src/modules/registry.ts](src/modules/registry.ts) | Tous les modules déclarés |
| [src/modules/surveys/index.ts](src/modules/surveys/index.ts) | Exemple de module |
| [src/lib/module-guard.ts](src/lib/module-guard.ts) | `requireModule`, `isModuleActive` |
| [src/lib/supabase-server.ts](src/lib/supabase-server.ts) | Client DB côté serveur |
| [src/app/admin/layout.tsx](src/app/admin/layout.tsx) | Sidebar dynamique |
| [src/app/api/auth/me/route.ts](src/app/api/auth/me/route.ts) | Qui suis-je + modules actifs |
| [src/app/api/surveys/route.ts](src/app/api/surveys/route.ts) | Exemple de Route Handler |
| [src/components/survey/SurveyRenderer.tsx](src/components/survey/SurveyRenderer.tsx) | Moteur de formulaire |
| [src/app/globals.css](src/app/globals.css) | Design system |

---

## 4. Ajouter un module en 6 étapes — tutoriel complet

Objectif : créer un module **"petitions"** (pétitions citoyennes). Temps : ~20 min.

### Étape 1 — Déclarer le module en BDD

Crée `supabase/migrations/005_add_petitions_module.sql` :

```sql
-- Idempotent : rejouable sans danger
insert into public.modules (id, name, tagline, icon, category, status)
values (
  'petitions',
  'Pétitions citoyennes',
  'Recueillez les pétitions de vos administrés',
  'FileSignature',
  'engagement',
  'beta'
)
on conflict (id) do nothing;
```

Applique la migration dans Supabase.

### Étape 2 — Créer la ModuleDefinition

Crée `src/modules/petitions/index.ts` :

```ts
import { FileSignature, Plus } from "lucide-react";
import type { ModuleDefinition } from "../types";

export const petitionsModule: ModuleDefinition = {
  key: "petitions",                 // ← doit matcher modules.id en BDD
  name: "Pétitions citoyennes",
  tagline: "Recueillez les pétitions de vos administrés",
  icon: FileSignature,
  status: "beta",
  adminNav: [
    { href: "/admin/petitions",     label: "Pétitions",  icon: FileSignature, exact: true },
    { href: "/admin/petitions/new", label: "Nouvelle",   icon: Plus,          exact: true },
  ],
  ownedPaths: ["/admin/petitions", "/api/petitions"],
};
```

### Étape 3 — Enregistrer dans le registre

Édite `src/modules/registry.ts` :

```ts
import { petitionsModule } from "./petitions";

export const MODULES: ModuleDefinition[] = [
  surveysModule,
  budgetModule,
  eventsModule,
  alertsModule,
  urbanismModule,
  petitionsModule,            // ← ajouter
];
```

À ce stade, si le module est activé pour une commune, la sidebar affiche les 2 liens.

### Étape 4 — Créer la page admin

Crée `src/app/admin/petitions/page.tsx` :

```tsx
import { redirect } from "next/navigation";
import { isModuleActive } from "@/lib/module-guard";

export default async function PetitionsPage() {
  if (!await isModuleActive("petitions")) {
    redirect("/admin/dashboard?module=petitions&state=inactive");
  }
  return (
    <main className="civiq-main">
      <h1 className="civiq-page-title">Pétitions</h1>
      {/* … */}
    </main>
  );
}
```

Toute page du module doit commencer par ce check `isModuleActive`.

### Étape 5 — Créer l'API du module

Crée `src/app/api/petitions/route.ts` :

```ts
import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET() {
  const guard = await requireModule("petitions");
  if (!guard.ok) return guard.response;

  const service = await createServiceClient();
  const { data } = await service
    .from("petitions")
    .select("*")
    .eq("commune_id", guard.communeId);

  return NextResponse.json(data ?? []);
}
```

### Étape 6 — Activer le module pour une commune

Depuis le compte super-admin, va sur `/super-admin/modules`, choisis la commune, coche `petitions`. Ou directement en SQL :

```sql
insert into public.commune_modules (commune_id, module_id)
values ('<commune-uuid>', 'petitions')
on conflict do nothing;
```

Recharge l'espace admin → la sidebar affiche "Pétitions".

---

## 5. Modifier la sidebar ou les tokens de design

- **Ajouter une entrée fixe** (non liée à un module) → `CORE_NAV_ITEMS` dans `src/app/admin/layout.tsx`.
- **Changer la couleur d'accent** → variable `--accent` dans `src/app/globals.css`.
- **Dark mode** → classes sous `[data-theme="dark"]` dans `globals.css`.

---

## 6. Debugging courant

| Problème | Cause probable | Fix |
|---|---|---|
| `Unexpected end of JSON input` sur `/api/...` | 500 non géré | check server logs, souvent un `createServiceClient` manquant |
| `__webpack_modules__[moduleId] is not a function` | cache `.next` corrompu | `rm -rf .next && npm run dev` |
| Sidebar vide en admin | aucun module activé | check `commune_modules`, activer au moins `surveys` |
| "Permissions insuffisantes" 403 | RLS récursif | lire `profiles` via `createServiceClient()` |
| Slug bizarre `besoins-prescolaires--` | caractères exotiques | `slugify()` strip accents NFD + collapse tirets |

---

## 7. Commandes utiles

```bash
npm run dev                   # dev server
npm run build                 # build de prod
npm run db:types              # régénère types Supabase (si CLI)
rm -rf .next && npm run dev   # clean rebuild
```

---

## 8. Où aller ensuite

- Architecture détaillée → [ARCHITECTURE.md](./ARCHITECTURE.md)
- Historique des décisions → [CLAUDE.md](./CLAUDE.md)
- Changements utilisateurs → [CHANGELOG.md](./CHANGELOG.md)
- Feuille de route → [ROADMAP.md](./ROADMAP.md)

Bienvenue dans CiviQ 🏛️
