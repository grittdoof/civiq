# Audit du module Projets & Commissions — Session 1

> **Date** : 25 septembre 2026 · **Périmètre** : `projects`, `commissions`, séances, calendrier, passerelle Tickets
> **Méthode** : lecture intégrale du code (`src/`, migrations 017 → 034), requêtes **en lecture seule** sur la base de production (projet Supabase `mgxqwwvtrggzjygddeyf`), advisors Supabase sécurité.
> **Aucune ligne de code, aucune donnée, aucune policy n'a été modifiée.**

---

## 0. À lire en premier

### 0.1 🚨 Faille critique hors périmètre — à corriger avant toute refonte

Découverte en interrogeant les advisors Supabase, **confirmée par `has_function_privilege`** :

| Fonction (SECURITY DEFINER) | Exécutable par `anon` | Effet |
|---|---|---|
| `make_super_admin(p_email)` | **oui** | Aucune vérification de l'appelant. Quiconque crée un compte via `/auth/register` puis appelle `POST /rest/v1/rpc/make_super_admin` avec la clé anon (publique, présente dans le bundle client) **devient super-administrateur de la plateforme**. |
| `purge_old_audit_log(p_days)` | oui | `p_days = 0` → **efface tout le journal d'audit**. |
| `purge_inactive_push_subscriptions(p_days)` | oui | Efface tous les abonnements push. |
| `purge_old_soft_deletes()`, `purge_expired_responses()` | oui | Purges déclenchables par un anonyme (dommage borné par leurs critères). |
| `log_audit(...)` | oui | Permet de forger des entrées d'audit. |

**Cause** : la migration 014 fait `grant execute … to service_role` mais **n'a jamais fait `revoke execute … from public`** ; en Postgres, `EXECUTE` est accordé à `PUBLIC` par défaut. Même cause pour `make_super_admin` (migration 003).
**Correctif** (une migration de 10 lignes, réversible) : `revoke execute on function … from public, anon, authenticated;` pour ces six fonctions. **Je ne l'ai pas appliqué** (consigne « aucun code ») — je recommande de le faire **immédiatement, indépendamment de la Session 2**. Vérifier aussi dans `profiles` qu'aucun `super_admin` inattendu n'existe (aujourd'hui : **1 seul**, cohérent).

### 0.2 Écarts entre le cahier des charges et la réalité du code

Le brief de Session 2 part de plusieurs hypothèses **fausses** sur l'existant. Elles changent la conception :

| Le brief suppose | Réalité constatée |
|---|---|
| Typographie Fraunces + DM Sans | **Montserrat** seule (`globals.css:12`) |
| Accent teal `#1D9E75` | **N'existe nulle part.** Accent = azur `#2F6FDB`, marine `#042F64` |
| shadcn/ui + Tailwind | `components.json` présent mais **shadcn n'est pas utilisé** (aucune dépendance Radix/CVA, `src/components/ui/` = 3 composants maison). Le module repose sur ~5 800 lignes de CSS `pj-*` avec **279 couleurs hex codées en dur** |
| Pas de distinction de types de projet | **Trois gabarits existent déjà** depuis la migration 028 : `investment` / `event` / `tracking` |
| Synchronisation Google Calendar possiblement active | **Aucune synchronisation n'existe** (ni OAuth, ni API). Seulement des liens « ajouter à l'agenda » et des `.ics` de convocation |
| Rôle « bureau municipal » à aligner | En production : **12 `editor` + 1 `super_admin`, zéro `admin`** |
| Table `contacts` éventuelle | **Aucune.** Quatre annuaires parallèles (§1.2) |
| Porte de financement bloquante (CLAUDE.md Session 7) | **Neutralisée** en avertissement par la migration 028 — et de toute façon **jamais appelée** (§1.3) |

→ La règle « n'invente aucun token » est incompatible avec un design system qui n'existe pas tel que décrit. **Décision requise** (voir §1.9 Q5).

---

## 1.1 Cartographie de l'existant

### Arborescence (≈ 23 000 lignes)

```
src/app/admin/projects/                         (pages serveur)
├── page.tsx                  307  Portefeuille : liste / lanes par phase, filtres commission & gabarit
├── nouveau/page.tsx          193  Choix du gabarit → INSERT silencieux dans un GET → redirect
├── comparatif/page.tsx       122  Comparatif coût global (RPC ×N)
├── cartographie/page.tsx     173  Parties prenantes transversales
├── revue-mensuelle/page.tsx  165  Synthèse imprimable
├── ppi/page.tsx              303  Plan pluriannuel d'investissement
├── projects.css / flow.css   4595 / 1182
└── [id]/
    ├── page.tsx               42  Redirection vers /phase/{projects.phase}
    ├── fiche/page.tsx        266  Fiche de synthèse (8 sections)
    ├── edit/page.tsx          73  ProjectForm (15 champs) + changement de type
    └── phase/[phase]/page.tsx 305 → [deliv]/page.tsx 144   Espace de phase / livrable

src/app/admin/commissions/     page 191 · [id] 272 · sessions/nouvelle 66 · sessions/[sid] 230
src/app/admin/calendrier/      page 35 (+ CalendarView 261) — lecture seule, interne
src/app/convocation/[token]/   page publique de réponse de présence (137 + RsvpForm 117)
src/app/projects-pdf/          PdfLoader (copie de tickets-pdf)

src/app/api/projects/**        34 route handlers (service role, gardés par requireModule + api-helpers)
src/app/api/commissions/**     19 route handlers
src/app/api/stakeholders, commune-settings, convocations/[token](/ics)

src/components/projects/       45 composants — DeliverablePage 1617 l., ProjectForm 576, …
src/lib/projects/              types 1070 · queries 530 · pdf-* 1073 · push 373 · convocation(-send) 548
                               state-machine 267 · rich-text 177 · cost-calc 163 · progress 149 · calendar-queries 141
src/modules/projects, registry  73 + 63 — jamais importés (mort)
tests/unit/projects/           state-machine (36 tests) · cost-calc (18) · convocation (19) · rich-text (9)
```

Détail fichier par fichier (rôle, lignes, client/serveur, tables) : disponible dans les notes d'audit, résumé ici pour lisibilité.

### Schéma — 24 tables du module

| Table | Lignes prod | Rôle | Remarque |
|---|---:|---|---|
| `projects` | **39** | Projet (31 colonnes) | `type`, `phase`, `phase_progress` jsonb, `phase_not_applicable` jsonb, `budget_estime`, 5 colonnes `tiers_*`, `in_ppi` |
| `milestones` | 18 | Jalons (`libelle`, `echeance`, `fait`, `phase`) | Pas de date réelle, pas de statut 3 états |
| `project_documents` | 10 | Pièces jointes | Pas de `deleted_at` ; URL signée figée en base |
| `project_stakeholders` | 11 | RACI projet × partie prenante | Index uniques **partiels** (piège `upsert`) |
| `stakeholders` | 8 | Annuaire parties prenantes (par commune) | Pas d'`updated_at`, pas d'unicité |
| `project_subscribers` | 26 | Abonnés aux notifications | Alimenté par trigger |
| `project_phase_log` | 7 | Historique de phase | Dernière écriture : **26 juin 2026** |
| `financings` | 1 | Subventions (20 colonnes après 024) | La seule ligne : DETR 300 k€ « accordée » **sans date de dépôt ni d'AR** |
| `project_budget_lines` | 2 | Budget interne (029) | Recouvre `financings` (catégorie `subvention`) |
| `project_authorizations` | 3 | Autorisations événement (029) | |
| `project_communications` | 1 | Plan de communication (029) | |
| `project_deliberations` | **0** | Délibérations (029) | |
| `project_quotes` | **0** | Devis (030) | HT et TTC tous deux facultatifs |
| `project_lifecycle_costs` | **0** | Coûts 1..10 ans | Aucune UI n'y écrit (bug §1.3) |
| `commune_settings` | **0** | Taux inflation / actualisation | Route jamais appelée |
| `commissions` | 6 | Commissions (couleur, icône, parent) | |
| `commission_members` | 29 | Membres (dont **16 externes** sans compte) | Contacts externes dupliqués par commission |
| `commission_projects` | 27 | Projet ↔ commission (N-N) | Le brief veut « une commission pilote » |
| `commission_sessions` | 4 | Séances | |
| `session_attendance` | 9 | Émargement + signature base64 | |
| `session_convocations` | 0 | Jetons de réponse de présence (034) | |
| `session_minutes_sends` | 2 | Historique d'envoi des CR | |
| `session_documents` | 3 | Documents de séance | |
| `session_decisions` | 0 | Décisions (trigger → jalon) | Aucune UI |

**Enums** : `project_phase` (15 valeurs : 7 investissement + 5 événement + 3 suivi), `project_type`, `project_competence`, `stakeholder_type`, `stakeholder_role`, `financing_status`, `financing_eligibility`, `project_tiers_type`, `commission_member_role`, `commission_session_statut`, `session_decision_type`. Neuf autres statuts sont des `text` + `CHECK` (incohérence de style).

**Fonctions / RPC** : `advance_project_phase`, `project_can_advance`, `project_global_cost`, `project_na_phases_between`, `project_phase_order/position/index`, `user_can_edit_project`, `financing_compute_eligibility` (jamais appelée, déclarée `immutable` alors qu'elle lit `current_date`), triggers `projects_autosubscribe_pilotes`, `session_decision_to_milestone`, `*_updated_at`.

**Vues** : aucune dans le module.

**Clés étrangères vers `projects`** : **toutes en `ON DELETE CASCADE`** (13 tables), sauf `tickets.project_id` et `session_decisions.project_id` (`SET NULL`). **Aucune table du module n'a de `deleted_at`** : supprimer un projet détruit physiquement jalons, financements, documents (lignes), devis, délibérations.

### Politiques RLS

RLS **activée sur les 24 tables** (aucune table sans RLS, aucun `using (true)` littéral). Schéma général :
- lecture : `user_can_access_commune(commune_id) AND my_role() IN (admin, editor, super_admin)` ;
- écriture sous-ressources : `user_can_edit_project(project_id)` ;
- `projects_delete` et `commissions_cud` : admin / super_admin (donc, en prod, **seul le super-admin** peut supprimer un projet ou créer une commission côté RLS).

Faiblesses détaillées en §1.5.

### Storage

| Bucket | Public | Limite | MIME | Fichiers | Taille |
|---|---|---|---|---:|---:|
| `project-documents` | non | 20 Mo | pdf, images, doc(x), xls(x) | 14 | 6,2 Mo |
| `project-photos` | **oui** | 5 Mo | jpeg, png, webp | 6 | 2,6 Mo |
| `commission-pdfs` | non | 20 Mo | pdf | **0 (inutilisé)** | — |
| `commune-logos` | oui | 2 Mo | png, jpeg | 1 | 89 ko |

Les documents de séance et les émargements signés sont rangés dans `project-documents` (et non `commission-pdfs`).

---

## 1.2 Interactions inter-modules

| Module | Couplage | Ce qui casse si Projets change | Duplications |
|---|---|---|---|
| **Tickets** | `tickets.project_id` (FK SET NULL, **1/61** lié) + `projects.source_ticket_id` (**1/39**) — deux liens pouvant diverger. `TransformTicketButton` monté dans `admin/tickets/[id]/page.tsx:260`. Deux parcours de conversion : `/api/projects/from-ticket` (toujours `investment`) et `nouveau?from_ticket=` (choix du gabarit) | Le bouton ticket → projet, le type `Ticket.project_id` (`lib/tickets/types.ts:69`) | `push.ts` projets = copie de `tickets/push.ts` (VAPID, purge 410) ; `PdfLoader`, `Font.register` ×4, `ProjectPhotoUpload`/`TicketPhotoUpload` ; demandeur ticket (`demandeur_nom/email/tel`) = 4ᵉ modèle de contact. **Le statut ticket n'a pas de valeur « converti en projet »** : un ticket converti reste dans la file active |
| **Sondages** | Aucun couplage de données | Rien | `src/lib/survey-event.ts` et `src/lib/projects/convocation.ts` réimplémentent chacun ICS + liens Google/Outlook (Outlook.live vs Outlook.office) |
| **Annuaire / contacts** | N'existe pas comme module | — | **Quatre annuaires** : `stakeholders` (8), `commission_members.external_*` (16 externes), `projects.tiers_nom/tiers_contact` (texte libre), `tickets.demandeur_*` — plus `profiles`. Copies figées dans `session_convocations.email`, `session_minutes_sends.recipient_*`. `financings.financeur` est un texte libre sans lien vers `stakeholders` de type `financeur` |
| **Calendrier** | `admin/calendrier` agrège jalons, séances, dates de financement (`calendar-queries.ts`) | Tout changement de `milestones` casse le calendrier | Pas de sync externe à préserver |
| **Notifications** | 4 préférences `notify_project_*` / `notify_commission` sur `notification_preferences` ; `project_subscribers` | Les préférences et le trigger d'abonnement des pilotes | **Deux piles email** : `lib/email.ts` (convocations, CR) et `lib/notifications/email.ts` (548 l., push projets/tickets). `push.ts:153` utilise `listUsers({perPage:1000})` ; envois push *fire-and-forget* après réponse (gelés par Vercel — même défaut que celui corrigé en Session 16) |
| **Dashboard admin** | Widgets projets (`dashboard/page.tsx:67-140`) | Compteur « en réalisation » | Toujours 0 (la phase n'avance jamais) |
| **Communes / super-admin** | `communes.address/phone/logo_*` utilisés par PDF et emails | — | `commune_settings` (taux) à côté de `communes.settings` jsonb |

**Utilitaires dupliqués** : `formatDate` ×2, `fmt`, `formatSessionDate`, ~20 `toLocale*` en ligne ; `formatEuros` + `fmtEur` ×2 ; libellés de compétence ×3, rôle « Vice-président·e » codé en dur ×4 alors que `COMMISSION_MEMBER_ROLE_LABELS` existe ; icônes de phase dans `PhaseIcon.tsx` alors que `PROJECT_PHASE_ICONS` / `PROJECT_PHASE_LUCIDE` existent ; `richTextToPlain` ≈ `htmlToPlainText`. `date-fns` est une dépendance jamais importée.

**Dates de séance** : les composants client (`CalendarView.tsx:164`, `ConvocationsPanel.tsx:31`) convertissent `date_seance` dans le fuseau du navigateur alors que la convention (Session 16) stocke l'heure murale en UTC → **décalage de +1 h / +2 h affiché**.

---

## 1.3 Dette et code mort

### Bugs fonctionnels majeurs découverts (pas du code mort, mais à connaître avant de supprimer quoi que ce soit)

1. **La phase d'un projet n'avance jamais depuis l'interface.** La seule route qui appelle `advance_project_phase` (`POST /api/projects/:id/advance`) n'est appelée que par `ProjectPhaseAdvanceDialog`, **importé nulle part**. Le bouton « Étape complète · Passer à » est un simple `<Link>`. `PATCH /api/projects/:id` refuse `phase`.
   *Preuve en base* : 38 projets sur 39 sont dans la **première** phase de leur gabarit ; `project_phase_log` n'a plus reçu d'écriture depuis le 26 juin 2026 (les 7 lignes sont des allers-retours de test le même jour).
2. **Aiguillage des livrables « champ »** : `FieldSection` (`DeliverablePage.tsx:783-822`) ne connaît que `lifecycle` et `bilan`, alors que le guide utilise `cost10y` et `financings` (`types.ts:245,271`) → « Coût global sur 10 ans » et « Part d'autofinancement » **affichent le sélecteur de pilotes**. `project_lifecycle_costs` ne peut jamais être rempli (0 ligne).
3. **Auto-cochage des livrables à l'échelle du projet** (`progress.ts:90-108`) : un seul document attaché coche tous les livrables « document » de **toutes** les phases.
4. **Création silencieuse dans un GET** (`nouveau/page.tsx:65-72`) : chaque rechargement / retour arrière crée un projet. *Preuve* : **8 projets « Sans titre » vides sur 39 (20 %)**.
5. **Liens de documents morts après 7 jours** : `getProject` renvoie `doc.url` (URL signée figée à l'upload) ; seul `GET /documents` re-signe.
6. **Éditeurs en ajout seul** : financements, jalons, parties prenantes, délibérations, autorisations, communications, budget — l'UI ne permet ni modifier ni supprimer (les routes PATCH/DELETE existent mais ne sont pas appelées).

### Tableau de dette

| Élément | Type | Statut | Preuve | Risque de suppression |
|---|---|---|---|---|
| `ProjectPhaseAdvanceDialog.tsx` | composant | non utilisé | 0 import | **Ne pas supprimer** : c'est le chaînon manquant du bug n°1 (à rebrancher ou remplacer) |
| `CollapsibleSection`, `DeleteProjectButton`, `ProjectListView`, `SubscribersEditor` | composants | morts | 0 import (grep `src` + `tests`), seules traces = commentaires CSS | Faible |
| `src/modules/projects/index.ts`, `src/modules/registry.ts` | fichiers | morts | registre jamais importé | Faible (vérifier l'intention « vision SaaS modules ») |
| `state-machine.ts` | lib | utilisé **uniquement par les tests** | grep | Moyen : 36 tests qui testent une logique que l'app n'exécute pas. À supprimer avec ses tests si la refonte abandonne les phases |
| `POST /api/projects`, `GET /api/projects` | route | non appelée | grep des `fetch` | Faible — mais **`POST` pourrait devenir la création non-silencieuse** de la refonte |
| `/api/projects/:id/advance` | route | non appelée | idem | Voir bug n°1 |
| `/subscribers*`, `/lifecycle-costs`, `financings/[fid]`, `milestones/[mid]`, `stakeholders/[psid]`, `deliberations/[did]`, `authorizations/[aid]`, `communications/[cid]`, `budget-lines/[bid]` | routes | non appelées par l'UI | grep | **Ne pas supprimer** : ce sont les PATCH/DELETE qui manquent à l'UI (bug n°6) |
| `POST …/sessions/[sid]/decisions` | route | aucune UI | grep | Moyen : route vulnérable (§1.5) |
| `/api/commune-settings` | route | non appelée ; **sans `requireModule`** | grep | Faible (table vide) |
| `GET /api/commissions`, `GET /api/commissions/:id` | route | non appelée | grep | Faible |
| `commune_settings` | table | vide (0 ligne), aucune UI | base + grep | Faible — **à absorber** dans le futur `commune_parametres` |
| `project_lifecycle_costs` | table | vide, inatteignable (bug n°2) | base | Faible. Pertinente seulement pour l'investissement |
| `project_deliberations`, `project_quotes` | tables | vides mais **utilisées** par l'UI | base = 0 ligne ; UI présente | Ne pas supprimer : nécessaires à la refonte (devis, n° de délibération) |
| `session_decisions` | table | vide, aucune UI | base + grep | Moyen (trigger dangereux §1.5) |
| `financing_compute_eligibility()` | fonction SQL | jamais appelée | grep + triggers | Faible |
| `financings.eligibilite` et 8 colonnes de 024 | colonnes | 1 ligne, valeurs par défaut | base | Faible, **à réévaluer** : la refonte réintroduit `date_accuse_reception` (déjà `date_ar`) |
| `projects.competence` | colonne | 37/39 = `a_verifier` (valeur par défaut) | base | Faible — champ jargon non renseigné |
| `projects.taux_inflation/actualisation`, `cout_reel`, `ecart`, `explication_ecart` | colonnes | tous NULL | base | Faible |
| `projects.concerne_tiers` + 4 `tiers_*`, `accompagne_sans_financer` | colonnes | **0/39** activés | base | Faible → absorbés par `contacts` |
| `projects.in_ppi` | colonne | 39/39 `true` (défaut), jamais basculé | base | Moyen : alimente la page PPI |
| `projects.phase_progress`, `phase_not_applicable` | colonnes jsonb | 31 projets avec cases cochées, notes toutes NULL | base | **Archiver**, ne pas convertir (§1.7) |
| bucket `commission-pdfs` | storage | 0 fichier, jamais utilisé | base + grep | Faible |
| index `idx_projects_commune`, `idx_projects_phase`, `idx_financings_project`, `idx_lifecycle_project`, `idx_attendance_session`, `idx_session_convocations_session` | index | redondants (couverts par composites/unicités) | `pg_indexes` | Nul |
| `date-fns`, `clsx`, `tailwind-merge` | dépendances npm | jamais importées | grep `src` | Nul (lockfile à régénérer) |
| Exports `getProjectPhases`, `isDeliverableRepeatable`, `getPhaseGuide`, `getPhasesGuideForType`, `PROJECT_PHASE_ICONS`, `PROJECT_PHASE_LUCIDE`, `COMMISSION_MEMBER_ROLE_LABELS`, `FINANCING_ELIGIBILITY_LABELS`, `formatPercent`, `notifyMilestoneDue`, `listStakeholders`, `htmlToPlainText`, `truncate`, `sessionStart` | exports | non utilisés | grep | Nul |
| CLAUDE.md Session 7 « porte non négociable » | doc | obsolète | migration 028 | — |

---

## 1.4 Performance

Volumétrie actuelle très faible (39 projets) : **aucun problème ressenti aujourd'hui**, mais plusieurs défauts deviendront bloquants en multi-communes.

| Constat | Où | Gravité |
|---|---|---|
| **N+1** : `rpc("project_global_cost")` appelée une fois par projet | `comparatif/page.tsx:34-36` | Moyenne |
| **N+1** : `auth.admin.getUserById` par membre interne, à chaque rendu de séance | `convocation-send.ts:84-91` | Moyenne |
| **Fuite de volume** : `cartographie` charge **tous** les `project_stakeholders` de **toutes** les communes puis filtre en JS (plafond PostgREST 1 000 lignes → troncature silencieuse) | `cartographie/page.tsx:39-57` | Haute (aussi un sujet de cloisonnement) |
| Filtres phase/recherche appliqués en JS après chargement complet, **sans pagination** ; `.in(ids)` sur de longues listes | `queries.ts:49-163` | Moyenne |
| `getProject` = 10 requêtes parallèles + 1 RPC, rappelé **intégralement** par chaque clic « livrable fait » (`DeliverablePage.tsx:1554`, `DeliverableNewSections`, `PhaseNaKebab`) puis réécriture du jsonb complet → **écritures perdues** en concurrence | | Moyenne |
| Avancement : **pas de N+1 sur la liste** (l'avancement n'y est pas calculé) ; le stepper se fonde sur `projects.phase` (figée) | `ProjectStepper.tsx:56` | — |
| `getSession` signe les documents un par un (au lieu de `createSignedUrls`) | `queries.ts:498-509` | Faible |
| **Index manquants** (FK vers `profiles`) : `projects.created_by`, `project_phase_log.user_id`, `milestones.responsable_user_id`, `commissions.responsable_user_id`, `commission_sessions.secretaire_*`, `session_decisions.responsable_user_id`, `project_documents.uploaded_by`, `project_stakeholders.stakeholder_id` | `pg_constraint` | Faible (volumétrie) |
| Index existants **suffisants** pour les filtres actuels (`commune_id, type`, `commune_id, phase`, `project_id` partout) | | — |
| **Aucun `next/image`** : `<img>` partout (`ProjectCard.tsx:47`, `ProjectsListExperience.tsx:406`, …) ; photos originales jusqu'à 5 Mo servies en miniature ; aucune transformation Supabase. `remotePatterns` est pourtant configuré | | Moyenne (mobile, 4G en campagne) |
| **Upload via Route Handler** : la limite annoncée de 20 Mo dépasse la limite de corps d'une fonction Vercel (~4,5 Mo) → échec probable en 413 au-delà. *À confirmer par un test* | `documents/route.ts` | Haute pour les devis/CR scannés |
| **Bundles client** : non mesurés (build de production non lancé dans cet audit, variables d'environnement requises). Candidats lourds : `DeliverablePage` (1 617 l., client), `recharts`, `framer-motion`, `SignaturePad`. **Action** : `next build` + `@next/bundle-analyzer` en début de Session 2 | | À mesurer |

---

## 1.5 Sécurité

Classement : 🔴 exploitable aujourd'hui · 🟠 exploitable sous condition · 🟡 défaut de conception.

| # | Constat | Preuve | Gravité |
|---|---|---|---|
| S0 | `make_super_admin` et purges exécutables par `anon` | §0.1 | 🔴🔴 |
| S1 | **Storage `project-documents` et `commission-pdfs` lisibles et inscriptibles par tout compte authentifié, toutes communes confondues.** L'inscription `/auth/register` étant ouverte, n'importe qui peut lister/télécharger devis, CR, émargements signés via le SDK Storage | policies `project_docs_read/upload`, `commission_pdfs_read/upload` = `auth.role()='authenticated'` | 🔴 |
| S2 | **XSS stockée** : `sanitizeRichText` laisse passer `<img/src=x onerror=alert(1)>` (le `/` après le nom de balise empêche le regex de réécriture de correspondre ; le filtre `on*=` n'attrape que les valeurs entre guillemets). HTML injecté via `dangerouslySetInnerHTML` dans la **page publique** `/convocation/[token]`, la page séance et `MinutesEditor`. CSP `'unsafe-inline'` | `RichTextEditor.tsx:113-138` (vérifié manuellement) | 🔴 |
| S3 | **IDOR inter-communes** (routes en service role sans contrôle de commune) : `PATCH/DELETE sessions/[sid]` (modifier l'ordre du jour — vecteur de S2 — d'une séance d'une autre commune), `POST sessions/[sid]/decisions` (+ trigger SECURITY DEFINER → **jalon écrit dans un projet d'une autre commune**), `POST/DELETE commissions/[id]/projects`, `DELETE commissions/[id]/members/[mid]`, `DELETE sessions/[sid]/documents/[did]` | revue des route handlers | 🔴 |
| S4 | `attendance_cud` : la branche « `conseiller_user_id = auth.uid()` » ne vérifie ni commune ni séance → émargement « présent + signature » possible dans n'importe quelle séance | migration 018:64-85 | 🟠 |
| S5 | FK jamais contraintes à la même commune : `stakeholder_id`, pilotes, `subscribers.user_id` (un utilisateur d'une autre commune reçoit push/emails), `commission_members.user_id`, `commissions.parent_id` | RLS + routes | 🟠 |
| S6 | RPC SECURITY DEFINER sans contrôle d'accès : `project_global_cost` (budget d'un projet d'une autre commune par UUID), `project_can_advance`, `project_na_phases_between` | advisors | 🟠 |
| S7 | Lectures sans contrôle du rôle (`user_can_access_commune` seul) : **signatures** d'émargement, emails/téléphones des membres externes, CR brouillons, journal de phase | RLS | 🟡 (aucun `viewer` rattaché aujourd'hui) |
| S8 | Uploads : **aucun contrôle MIME réel ni d'extension** sur les documents ; `contentType = file.type` fourni par le client (HTML déposable dans un bucket privé) | `documents/route.ts` | 🟠 |
| S9 | `project-photos` **public** : photos de projets confidentiels accessibles par URL devinable | bucket | 🟡 (bloquant pour §2.10 « confidentiel ») |
| S10 | Suppression Storage : un admin de **n'importe quelle** commune peut supprimer (policies `*_delete` sur `my_role()` global) | policies | 🟠 (multi-communes) |
| S11 | Règles métier **uniquement côté client ou nulle part** : porte de financement (avertissement seulement), progression / phases N/A (jsonb librement modifiable par PATCH), changement de type (réécrit `phase` hors RPC, sans journal) | code + 028 | 🟡 |
| S12 | `/api/convocations/[token]` public **sans limitation de débit** ; modification autorisée après la séance (seul `compte_rendu_valide` est testé) | route | 🟡 |
| S13 | Données personnelles dans les payloads : `getCommission` renvoie email + téléphone des externes à tout éditeur ; `listUsers({perPage:1000})` charge **tous les utilisateurs de la plateforme** en mémoire pour un push | `push.ts:153` | 🟡 |
| S14 | Aucune donnée personnelle en paramètre d'URL constatée (le jeton de convocation est opaque, 192 bits) | — | ✅ |

**Cloisonnement multi-communes** : la RLS est correcte **pour les tables `projects/*`**. Les fuites viennent (1) du Storage, (2) des routes qui utilisent le service role sans filtre de commune, (3) des triggers/RPC SECURITY DEFINER. Tout cela ne se voit pas avec une seule commune en production — mais deviendra un incident au deuxième déploiement.

---

## 1.6 Diagnostic « usine à gaz »

### L'hypothèse testée

> *La complexité vient d'un workflow unique appliqué indifféremment à un projet de 2 000 € et à un projet de 800 000 €, et de l'absence de distinction entre investissements, événements et suivis simples.*

**Verdict : infirmée dans sa lettre, confirmée dans son esprit.**

- **Infirmée** : la distinction existe depuis la migration 028. Il y a trois gabarits (7, 5 et 3 phases) et les utilisateurs **s'en servent** : 11 investissements, 3 événements, **25 suivis** (64 %).
- **Confirmée** : chaque gabarit, y compris « suivi », reste un **workflow de phases à portes** avec 3 à 5 livrables par phase, pilotés par un guide jsonb. Le suivi d'un dossier « recherche de médecins » passe par le même moteur (phases, livrables, cases à cocher, portes) que la réhabilitation des halles. Il n'y a pas de parcours léger ; il y a un parcours lourd en trois tailles.

### Ce que disent les données réelles (39 projets)

| Indicateur | Valeur | Lecture |
|---|---|---|
| Projets avec un budget renseigné | **2 / 39** | Le bloc financier n'est pas utilisé |
| Lignes de financement | **1** (DETR « accordée » sans date de dépôt ni d'AR) | Le formulaire subventions (20 colonnes) ne produit pas de données fiables |
| Devis, délibérations, coûts 10 ans | **0 / 0 / 0** | Fonctionnalités jamais utilisées (ou inatteignables) |
| Compétence renseignée | **2 / 39** (37 « à vérifier ») | Champ jargon ignoré |
| Tiers, accompagnement sans financer | **0 / 39** | |
| Projets « Sans titre » vides | **8 / 39 (20 %)** | Création silencieuse |
| Doublons manifestes | « Lotissement Gourlière 2 » ×2, « Audit Fioul, GO et GNR » ×2 (un en événement, un en suivi) | L'utilisateur recrée au lieu de corriger (type, titre) |
| Projets sans élu référent | **18 / 39** | Le brief a raison d'imposer un référent unique |
| Projets rattachés à une commission | 27 / 39 | La commission est le vrai axe de rangement |
| Projets avec ≥ 1 jalon | **8 / 39** (18 jalons) | Les jalons libres sont la donnée la plus utile… |
| Projets ayant changé de phase | **1** (hors tests) | …alors que le moteur de phases ne fonctionne pas |
| Usage réel | titre, description, commission, élu, quelques jalons datés, documents | **C'est exactement le « suivi simple » du brief** |

Exemples concrets : *Aménagement de la rue Rivaudeau* (type suivi, 1 jalon, 0 € de budget) ; *élection du Conseil municipal des jeunes* (6 jalons datés, rien d'autre) ; *Les Halles* (investissement > 500 k€ : 1 jalon, 1 financement, aucun devis ni délibération).

### D'où vient la complexité perçue

| Nature | Constat | Poids |
|---|---|---|
| **Workflow** | Moteur de phases à portes (15 phases, ~60 livrables) plaqué sur tous les types. L'utilisateur doit comprendre « Émergence », « Faisabilité & cadrage », « Conception & marchés » avant de noter une réunion. Et le moteur est **cassé** : la phase n'avance pas, l'avancement ne signifie rien | **Principal** |
| **Interface** | Création silencieuse (pas de formulaire, projet vide immédiat). Fiche fragmentée en pages de livrables (`/phase/x/y`). Formulaire projet à 15 champs dont 8 jargonneux (compétence, taux d'actualisation, tiers, PPI). Éditeurs en ajout seul (impossible de corriger → doublons). Deux chemins de navigation (fiche vs phases) | **Fort** |
| **Modèle de données** | 24 tables pour 39 projets et 18 jalons. Quatre modèles de suivi concurrents (`milestones`, `phase_progress` jsonb, tables typées 029/030, documents typés `devis`/`deliberation` **et** tables `project_quotes`/`project_deliberations`). Budget en trois endroits (`budget_estime`, `project_budget_lines`, `financings`) sans consolidation | **Fort** |
| **Accidentelle** | Duplication push/email/ICS/PDF avec Tickets et Sondages ; 5 composants morts ; `state-machine.ts` jamais exécuté ; exports morts ; 5 800 lignes de CSS avec couleurs en dur ; `src/modules` fantôme | Moyenne (coûte en maintenance, peu en usage) |

**Conclusion** : la refonte proposée en Session 2 (étapes simples communes aux trois types, blocs activés par type, pédagogie en microcopie plutôt qu'en phases) **attaque la bonne cause**. L'essentiel du gain viendra de la **suppression du moteur de phases comme structure de navigation**, pas de l'ajout de types.

---

## 1.7 Plan de migration

### Principes

1. **Aucune suppression physique** : ajout de `deleted_at` / `archived_at` sur `projects` et sur toutes les tables enfants **avant** toute transformation. Passage des FK `ON DELETE CASCADE` en `RESTRICT` (ou `NO ACTION`) pour que plus aucune suppression ne soit en cascade.
2. **Coexistence** : les nouvelles tables sont créées à côté des anciennes ; les anciennes colonnes sont **conservées en lecture seule** pendant au moins un cycle (renommées `legacy_*` si nécessaire), puis archivées.
3. **Une migration par changement logique**, chacune avec son `down` explicite (le projet n'en a aucun aujourd'hui).
4. Répétition complète sur une **branche Supabase** (copie de prod) avant application.

### Sauvegarde préalable et rollback

| Étape | Contenu |
|---|---|
| S-1 | `pg_dump --data-only` des 24 tables du module + `tickets`, `communes`, `profiles` (format custom et **CSV par table** pour archivage lisible) |
| S-2 | Export **JSON par projet** (projet + enfants) — c'est aussi la base de l'export CADA |
| S-3 | Copie intégrale des buckets `project-documents` et `project-photos` (20 fichiers, 8,8 Mo) vers un stockage d'archive, avec manifeste SHA-256 |
| S-4 | Vérifier la disponibilité du PITR (Point-in-Time Recovery) sur le plan Supabase ; sinon la sauvegarde S-1 est le seul filet |
| Rollback | Chaque migration `up` a son `down`. Les données anciennes n'étant jamais supprimées, le rollback consiste à : réactiver l'ancienne UI (feature flag par commune `commune_modules.settings.projects_v2`), exécuter les `down` dans l'ordre inverse, restaurer S-1 en dernier recours |

**Archives publiques** : les 14 fichiers de `project-documents` (devis, listes, fichiers xlsx) et les CR de séance relèvent du Code du patrimoine. Ils restent en place ; seules les lignes de métadonnées migrent vers les nouvelles tables avec le même `storage_path`.

### Correspondance ancien → nouveau schéma

Les noms cibles reprennent le brief ; **je recommande de garder les tables existantes et de les étendre** plutôt que de créer des doublons en français (`projet`, `etape`) — sinon on reproduit la duplication que l'audit dénonce. Décision à valider (Q6 ci-dessous).

| Ancien | Nouveau | Sort | Règle |
|---|---|---|---|
| `projects.id, commune_id, titre, description, photo_*, created_by, date_creation, date_maj` | `projects` (inchangé) | **Conservé** | — |
| `projects.type` (enum `investment/event/tracking`) | `projects.type_code` → FK `types_projet.code` (`investissement/evenementiel/suivi_simple`) | **Transformé** | Correspondance 1-1 ; l'enum reste en colonne legacy |
| `projects.pilote_elu` | `elu_referent_id` | Conservé (renommé ou vue) | Requis à la création ; 18 projets sans élu → affichés « référent à désigner » |
| `projects.pilote_agent` | `agent_pilote_id` | Conservé | |
| `projects.budget_estime` | `fourchette_estimation` (enum 5 valeurs) + lignes budgétaires | **Transformé** | 0 → « Je ne sais pas encore » ; > 500 k → « > 500 000 € » ; la valeur exacte devient une ligne budgétaire prévisionnelle HT « Estimation initiale » |
| `projects.sans_subvention` | `autofinancement_assume` (+ auteur, date) | Transformé | 1 projet concerné ; auteur = `created_by`, date = `date_maj`, motif « repris de l'ancienne version » |
| `projects.phase`, `phase_progress`, `phase_not_applicable` | — | **Archivé** | Copiés dans `projects.legacy_workflow` (jsonb) puis exclus de l'UI. **Pas de conversion en étapes** : ce sont des cases de gabarit sans contenu (toutes les notes sont NULL) |
| `projects.competence`, `in_ppi`, `taux_*`, `cout_reel`, `ecart`, `explication_ecart` | — | Archivé | Valeurs par défaut ou NULL sur 37-39 projets |
| `projects.concerne_tiers`, `tiers_*`, `accompagne_sans_financer` | `contacts` + `project_contacts` | Abandonné (0 donnée) | |
| `projects.source_ticket_id` ↔ `tickets.project_id` | un seul lien `tickets.project_id` + statut `converti_en_projet` | Transformé | Le lien existant (1) est préservé |
| — | `projects.confidentiel`, `avancement_pct`, `avancement_manuel_*`, `deleted_at` | **Ajoutés** | |
| `milestones` (18) | `etapes` (ou `milestones` étendu) | **Transformé** | `libelle` → libellé ; `echeance` → `date_previsionnelle` ; `fait=true` → statut `terminé`, `false` → `à faire` ; `date_reelle` = NULL ; `est_un_jalon = true` ; `remonter_au_reporting = true` ; `responsable_user_id` → partie prenante ; `phase` archivée |
| `project_documents` (10) | pièces jointes d'étape ou de projet | Conservé | Ajout `note_interne=false`, `deleted_at` ; `url` figée supprimée au profit d'une signature à la volée |
| `project_quotes` (0) | `devis` | Conservé + étendu | `montant_ht` NOT NULL, `taux_tva`, TTC calculé, `retenu`, `prestataire` → `contact_id` |
| `financings` (1) | `subventions` | **Transformé** | `financeur` → `contact_id` (type financeur) ; `date_ar` → `date_accuse_reception` ; `date_demande` → `date_depot` ; statuts : `a_demander`→à contacter, `demandee`→dossier déposé, `ar_recu`→en cours d'étude, `accordee`, `refusee`, `soldee` ; colonnes d'éligibilité archivées. **La ligne DETR « accordée » sans date sera signalée** (alerte AR manquant) |
| `project_budget_lines` (2) | lignes budgétaires | Transformé | `montant_prevu` → `montant_ht` prévisionnel ; événementiel → section fonctionnement ; catégories `subvention/mecenat` → recettes |
| `project_deliberations` (0) | conservé | Conservé | Fournit le n° de délibération de la fiche A4 |
| `project_authorizations` (3), `project_communications` (1) | étapes typées du rétroplanning événement | Transformé | Chaque ligne → étape (libellé, échéance, statut) |
| `project_lifecycle_costs` (0) | — | Abandonné | Vide |
| `stakeholders` (8) + `commission_members.external_*` (16) + `tiers_*` + `tickets.demandeur_*` | **`contacts`** unique | **Fusionné** | Dédoublonnage par email normalisé puis nom ; `commission_members.contact_id` remplace `external_*` (colonnes gardées en legacy) ; `project_stakeholders` → `project_contacts` |
| `commission_projects` (27, N-N) | `projects.commission_pilote_id` + tags `commissions_associees` | Transformé | Vérifié en base : les 27 projets rattachés ont **exactement une** commission → bascule directe en commission pilote, sans perte. Les 12 projets sans commission restent « commission à désigner » |
| `commune_settings` (0) | `commune_parametres` | **Absorbé** | Table vide |
| `project_phase_log` (7) | historique projet | Conservé en lecture | |
| Tables séances / convocations / émargement | inchangées | Conservées | Hors refonte ; corrections de sécurité seulement |

### Rattachement des 39 projets aux trois types

**Règle de bascule retenue** : *on conserve le type choisi par l'utilisateur* (1-1), sauf pour les anomalies ci-dessous, présentées **pour validation nominative** (pas de reclassement automatique).

| Cas | Projets | Proposition |
|---|---|---|
| Mapping direct | 11 `investment` → investissement ; 3 `event` → événement ; 25 `tracking` → suivi simple | Automatique |
| Brouillons vides « Sans titre » (aucune donnée enfant) | **8** | Archivage (`archived_at`), pas de suppression |
| Doublons | « Lotissement Gourliere 2 » / « Lotissement La Gourlière 2 » ; « Audit Fioul, GO et GNR » (événement) / idem (suivi, avec 1 jalon et 1 document) | Garder celui qui porte des données, archiver l'autre |
| Mal typés probables | « Audit Fioul, GO et GNR » en **événement** ; « Adhésion au réseau Unicef » en **investissement** ; « test » | → suivi simple / archivage |
| Investissements sans aucune donnée financière | Terrain Riou, Clocher, Bibliothèque, Lotissement Gourlière 2 | Rester en investissement (ce sont de vrais projets structurants), avec jalons types proposés **décochés** à la première ouverture |

---

## 1.8 Recommandations priorisées

| # | Action | Impact | Effort | Risque | Priorité |
|---|---|---|---|---|---|
| 1 | **Révoquer `EXECUTE` public** sur `make_super_admin`, `purge_*`, `log_audit` (§0.1) | Critique | S | Nul | **P0 — immédiat, hors Session 2** |
| 2 | Policies Storage `project-documents` / `commission-pdfs` : restreindre par préfixe `commune_id/` (ou tout passer par le service role + URLs signées) | Critique | S | Faible (vérifier les chemins existants) | **P0** |
| 3 | Corriger `sanitizeRichText` (parseur réel, p. ex. `sanitize-html` côté serveur) et ré-assainir les `ordre_du_jour` / `compte_rendu` existants | Critique | S | Faible | **P0** |
| 4 | Ajouter le contrôle de commune aux routes IDOR (S3) ; borner `attendance_cud` et le trigger `session_decision_to_milestone` | Haut | S | Faible | **P0** |
| 5 | Soft delete (`deleted_at`) + FK `RESTRICT` sur tout le module ; sauvegardes S-1 à S-3 | Haut (archives publiques) | M | Faible | **P1 — prérequis refonte** |
| 6 | Mesurer les bundles et tester l'upload > 4,5 Mo (passer à l'upload direct par URL signée) | Moyen | S | Nul | P1 |
| 7 | Table `contacts` unique + fusion des 4 annuaires | Haut | M | Moyen (dédoublonnage) | P1 |
| 8 | Remplacer le moteur de phases par les **étapes** communes + blocs par type (§2.2-2.4) ; création non silencieuse | **Très haut** (cause n°1) | L | Moyen | P1 |
| 9 | `avancement_pct` dénormalisé par trigger ; override manuel tracé | Haut | S | Faible | P1 |
| 10 | Contrôles serveur : 20 % commune, plafond 80 %, **blocage démarrage des travaux sans AR** | Très haut (valeur métier) | M | Moyen | P1 |
| 11 | Ticket → projet : statut `converti_en_projet`, un seul lien, notification du demandeur | Moyen | S | Faible | P2 |
| 12 | Seuils de commande publique versionnés + paramètres commune | Haut | M | Faible | P2 |
| 13 | Aides-territoires (cache, cron hebdo) + alerte de campagne DETR/DSIL | Très haut | M | Moyen (dépendance externe) | P2 |
| 14 | `next/image` + transformations Supabase pour les miniatures | Moyen (mobile) | S | Nul | P2 |
| 15 | Mutualiser push / email / ICS / PDF / formatage dates et montants avec Tickets et Sondages ; corriger le décalage horaire des séances côté client | Moyen | M | Faible | P2 |
| 16 | Supprimer le code mort listé en §1.3 (**après validation nominative**) et `date-fns`, `clsx`, `tailwind-merge` | Faible | S | Faible | P3 |
| 17 | Mettre à jour CLAUDE.md (porte de financement, design system réel) | Faible | S | Nul | P3 |

---

## 1.9 Questions avant la Session 2

Pré-réponses tirées de l'audit, **à confirmer** :

1. **Table `contacts` / annuaire existant ?** — Aucune. Quatre annuaires : `stakeholders`, `commission_members.external_*`, `projects.tiers_*`, `tickets.demandeur_*`. → Je propose de créer `contacts` et d'y **fusionner** les quatre. OK ?
2. **Synchronisation Google Calendar ?** — N'existe pas. Seuls existent des `.ics` de convocation et des liens « ajouter à l'agenda ». → Rien à préserver ; le flux iCal signé par utilisateur sera une nouveauté. OK ?
3. **Rôles et « bureau municipal » ?** — Rôles : `super_admin`, `admin`, `editor`, `viewer`. En production, **aucun `admin`** : les 12 comptes de Châteauneuf sont `editor`. Le « bureau » (maire + adjoints) n'est donc pas représentable aujourd'hui. Options : (a) promouvoir le maire et les adjoints en `admin` ; (b) ajouter un indicateur `bureau_municipal` sur `profiles` ; (c) un rôle dédié. **Laquelle ?**
4. **Multi-communes en base ?** — Oui, structurellement (`commune_id` + RLS partout, 1 seule commune en prod). Mais les fuites Storage / IDOR (§1.5) doivent être corrigées avant un deuxième déploiement.
5. **Token couleur pour les événements ?** — Le design system décrit dans le brief (Fraunces, DM Sans, teal `#1D9E75`, shadcn) **n'est pas celui du code** (Montserrat, azur `#2F6FDB`, CSS maison). Il existe un token ambre `--warning` (`oklch(0.68 0.130 72)`), mais il porte déjà les avertissements, et la commission Urbanisme utilise déjà `#F39C12` (ambre). **Utiliser l'ambre pour les événements créerait une double confusion** (alerte ≠ événement ; type ≠ commission). → Deux décisions : (a) garde-t-on le design system réel ou migre-t-on vers celui du brief ? (b) quelle couleur dédiée aux événements ?
6. **(Ajoutée)** Étendre les tables existantes (`projects`, `milestones`, `financings`, `project_quotes`) ou créer de nouvelles tables en français (`projet`, `etape`, `subventions`, `devis`) ? Je recommande **d'étendre** : moins de migration, pas de doublon.
7. **(Ajoutée)** Validez-vous le rattachement proposé des 39 projets (§1.7), en particulier l'archivage des 8 « Sans titre » et des doublons ?
8. **(Ajoutée)** Les seuils de commande publique du brief (décret n° 2025-1386, loi n° 2026-403) n'ont pas pu être vérifiés dans cet audit ; qui valide les valeurs du seed avant mise en production ?
9. **(Ajoutée)** Corrige-t-on les failles P0 (§1.8, lignes 1 à 4) **maintenant**, dans une branche dédiée, avant la refonte ?

### Décisions reçues (25/09/2026)

| Q | Décision |
|---|---|
| Q6 | **Étendre les tables existantes** (pas de tables doublons en français) |
| Q7 | **Rattachement validé** tel que proposé en §1.7 (dont archivage des 8 « Sans titre » et des doublons) |
| Q8 | Le périmètre de décision du maire est fixé par **la délibération de délégation du conseil municipal** (`seuil_delegation_maire_ht` + n° et date, paramètre communal). Les seuils nationaux de publicité restent une table globale distincte, gérée par le super-admin |
| Q9 | **Correctifs P0 faits maintenant**, branche `claude/securite-p0` : migration `035_securite_p0.sql` (+ rollback `supabase/rollback/035_securite_p0_down.sql`), contrôles de commune sur les routes commissions/séances, `sanitizeRichText` réécrit (échappement total + liste blanche) et ré-appliqué à l'affichage |
| Q1 | **Table `contacts` unique** : créée et alimentée par fusion de `stakeholders`, `commission_members.external_*`, `projects.tiers_*`, `tickets.demandeur_*` |
| Q2 | **Synchronisation Google Agenda à prévoir** (n'existe pas aujourd'hui) : à ajouter au périmètre de la Session 2, en plus du flux iCal signé par utilisateur |
| Q3 | **Bureau municipal = les comptes de rôle `admin`** de la commune (« la personne choisie comme administrateur »). Le flag `confidentiel` restreint la lecture aux `admin` + `super_admin`. ⚠ Aucun `admin` à Châteauneuf aujourd'hui : il faudra en désigner au moins un avant d'utiliser les projets confidentiels |
| Q4 | **Multi-communes confirmé** : cloisonnement par `commune_id` obligatoire partout, y compris Storage, RPC et routes service role |
| Q5 | **Design system réel conservé** (Montserrat, azur `#2F6FDB`, marine `#042F64`, CSS `pj-*`). Les mentions Fraunces / DM Sans / teal / shadcn du brief sont caduques. Couleur dédiée aux événements : **`#B0306A` validée** (§1.10) |

### 1.10 Couleur des événements — validée le 25/09/2026

Contraintes : ni `--warning` (ambre, déjà porteur des alertes), ni une des 8 couleurs de la palette des commissions (`#5A8DEE`, `#FF5A5F`, `#2BB673`, `#F39C12`, `#9B59B6`, `#1ABC9C`, `#E74C3C`, `#34495E`), contraste ≥ 4,5:1 pour le texte.

Proposition : un **nouveau token unique** `--type-event` en magenta prune `#B0306A` (texte blanc dessus ≈ 6:1 ; en fond clair `#FBEAF2` avec texte `#B0306A` ≈ 5,2:1), accompagné des tokens `--type-investment` = `var(--marine)` et `--type-tracking` = gris `--gris-*` existant. Toujours doublé d'une icône (chantier / calendrier-étoile / liste) et du libellé texte.

---

**Session 1 validée.** Migration 035 appliquée en production le 25/09/2026 — PR https://github.com/grittdoof/civiq/pull/4.
