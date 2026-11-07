# Module « Tickets d'intervention » — audit et architecture cible (phase 1)

> Livrable de phase 1, à valider avant les maquettes (phase 2) et tout développement (phase 3).
> État constaté le 2026-11-07 sur la branche `main` (après la PR 26) et en production (lecture seule).

---

## 1. Audit de l'existant

### 1.1 Données en production

| Élément | Valeur |
|---|---|
| Communes avec le module actif | 1 (Châteauneuf) |
| Tickets | 103 — 67 clos, 32 assignés, 2 en cours, 2 nouveaux |
| Catégories utilisées | espaces verts 28, **autre 28**, voirie 26, bâtiments 11, mobilier 5, propreté 2, éclairage / eau / signalisation 1 |
| Priorités | normale 57, haute 30, urgente 14, basse 2 |
| Canaux | téléphone 34, élu terrain 34, agent interne 27, email 8 |
| Photos | 57 (41 signalement, 16 service fait), **toutes en JPEG, toutes présentes dans le stockage** |
| Rapports de clôture | 70, **0 avec document joint** |
| Comptes de la commune | 1 super-admin, 3 admin, 7 éditeurs — fonctions : 1 maire, 3 adjoints, 4 conseillers, 2 agents, 1 secrétaire |

Il n'y a aujourd'hui **aucun compte agent de terrain** : le module est utilisé par les élus et le secrétariat.

### 1.2 Modèle de données (migrations 010, 012, 013, 015, 047, 049, 055, 056)

- `tickets` : `commune_id`, `categorie` (enum de 9 valeurs), `priorite` (enum basse → urgente), `statut` (enum de 9 valeurs, l'interface n'en montre que 2 : Ouvert / Clôturé), `canal`, champs demandeur, géolocalisation, `assigne_a` (assigné principal), `echeance`, réouverture planifiée, `project_id` (passerelle vers Projets).
- `ticket_assignees` (plusieurs assignés), `ticket_photos` (bucket privé `tickets-photos`), `ticket_commentaires` (commentaires + lignes système = le journal), `ticket_rapports` (rapport de clôture, `document_paths` vers le bucket privé `tickets-documents`).
- `audit_log` existe (acteur, action, cible, métadonnées) mais le module Tickets ne l'alimente pas.
- **Absents** : notion de service, sous-catégorie, confidentialité, destinataires nommés, délai cible (SLA), « transmis à un gestionnaire externe », site/école.

### 1.3 Rôles et droits actuels

Deux axes coexistent :

- `profiles.role` (droits de la plateforme) : `super_admin`, `admin` (bureau municipal), `editor`, `viewer`.
- `profiles.job_title` (fonction, affichage) : maire, adjoint, conseiller, dgs, secretaire, agent, agent_technique, associatif, citoyen, autre.

Droits constatés :

| Action | Qui aujourd'hui |
|---|---|
| Voir | **Tout membre de la commune voit tous les tickets** (RLS `user_can_access_commune` ; requêtes serveur filtrées sur la seule commune) |
| Créer | admin, éditeur, super-admin |
| Modifier | admin, éditeur, super-admin, assigné, créateur |
| Assigner | admin, éditeur, super-admin |
| Clôturer / rouvrir | admin, éditeur, super-admin, assigné |
| Commenter | quiconque peut modifier |
| Supprimer | super-admin uniquement |

Conséquences : aucun cloisonnement possible (service, confidentialité) ; le temps réel (`useTicketsRealtime`, clé utilisateur + RLS) diffuserait aujourd'hui tout nouveau ticket à toute l'équipe.

### 1.4 Pièces jointes et stockage

- Photos : compressées en JPEG dans le navigateur, déposées avec la clé utilisateur sous `<commune>/<uuid>.jpg` ; policies restreintes à la commune depuis la migration 056 (appliquée). Lecture : liens signés de 1 h fabriqués **au rendu serveur** de la page.
- Documents de clôture : bucket `tickets-documents` créé le 07/11 (migration 055) — avant, tous les dépôts échouaient (d'où 0 document sur 70 rapports). Liens signés 1 h avec l'option `download` (force le téléchargement).
- CSP : `img-src` autorise `*.supabase.co` ; `frame-src` ne l'autorise pas (un aperçu PDF intégré serait bloqué).

### 1.5 PWA

- `manifest.webmanifest` : lancement sur `/pwa-launch.html` → redirection fixe vers `/admin/dashboard` ; raccourcis « Nouveau ticket » et « Mes tickets ».
- `public/sw.js` : HTML en réseau d'abord + page hors ligne, assets en cache, API jamais en cache, notifications push. Le **mode hors ligne de création de ticket est documenté (`docs/BACKGROUND_SYNC.md`) mais pas implémenté** côté application (aucune file IndexedDB, aucun `registration.sync`).
- Accueil identique pour tous les profils.

### 1.6 Autres défauts relevés

1. **Liste tronquée à 100 tickets** : `listTickets` applique `limit(100)` par défaut ; la commune en a 103 → l'onglet « Tous » et ses compteurs en perdent 3.
2. `listTickets` lit **toutes les photos de la plateforme** (pas de filtre commune) puis les associe en mémoire ; la liste fait 3 appels complets à `listTickets` par affichage.
3. 28 tickets sur 103 en catégorie « Autre » : la taxonomie actuelle ne couvre pas les besoins.
4. `notifyUrgentUnassigned` cible `job_title = agent_technique` (aucun compte) ou adjoint ou admin.

---

## 2. Bug des pièces jointes — diagnostic

| Piste | Constat | Cause ? |
|---|---|---|
| Photo cliquée sur la fiche | `<img>` dans `.tk-photo-gallery`, curseur « loupe » en CSS **mais aucun lien ni visionneuse** : le clic ne fait rien | **Oui — cause principale** |
| Lien signé expiré | Lien d'1 h fabriqué au rendu ; en PWA, la page reste ouverte en arrière-plan pendant des heures → image cassée, lien mort (`InvalidJWT`) | **Oui — en PWA** |
| Documents de clôture | Bucket inexistant jusqu'au 07/11 : aucun document n'a jamais été enregistré | Oui (corrigé en Session 31) |
| PDF qui se télécharge au lieu de s'ouvrir | Option `download` sur le lien signé | Oui (gêne) |
| Fichier absent / mauvais type MIME | 57/57 photos présentes, toutes `image/jpeg` | Non |
| Service worker | Les requêtes vers Supabase (autre origine) ne sont pas interceptées | Non |
| CSP | `img-src` autorise Supabase | Non (mais un aperçu PDF intégré serait bloqué) |

**Vérifié en production le 2026-11-07** (ticket #111, 4 photos) : les 4 fichiers se chargent (JPEG valides, 1440×1920) mais un clic sur une photo ne déclenche rien (aucun lien, aucune visionneuse). Chaque vignette charge la photo entière (0,5 à 1,1 Mo, 0,7 à 1,3 s) : la liste et la fiche s'affichent par morceaux, les vignettes restent grises un moment sur mobile. L'onglet « Tous » affiche 100 au lieu de 103.

Ajout au correctif : générer une **miniature** (≈ 400 px, ≈ 40 Ko) au dépôt, utilisée par les listes et les galeries ; la photo entière n'est chargée qu'à l'ouverture.

**Correctif proposé (lot 6)** : une adresse stable sur notre domaine pour chaque pièce, `/api/tickets/<id>/pieces/<piece>`, qui vérifie les droits **au moment de l'ouverture** (mêmes règles que le ticket), journalise la consultation si le ticket est restreint ou confidentiel, puis redirige vers un lien signé de 2 minutes, en affichage (`inline`) pour les images et les PDF. Le lien ne périme donc jamais côté page. Visionneuse plein écran pour les photos (balayage, Échap, « Ouvrir dans un nouvel onglet », « Télécharger »), PDF dans un nouvel onglet, Word/Excel en téléchargement. Suppression de la policy de **lecture** directe du bucket photos (lecture uniquement via le serveur) pour que la confidentialité ne soit pas contournable en listant le dossier de la commune. Correction de la limite à 100 au passage.

---

## 3. Modèle de permissions (révisé après validation du 2026-11-07)

### 3.1 Principe : simple et réglable par mairie

Chaque mairie fonctionne différemment : rien n'est figé dans le code. Trois briques seulement.

1. **Accès au module** : le super-admin active ou non le module Tickets **par utilisateur** (mécanisme existant). Sans activation, la personne ne voit rien du module, quelle que soit sa fonction.
2. **Fonction** de la personne (`job_title`, existant) : elle désigne sa ligne dans la matrice.
3. **Matrice fonction × action, propre à chaque commune**, réglée par le super-admin (fiche de la commune, onglet Tickets). Une matrice par défaut est posée à l'activation du module ; le super-admin l'ajuste.

S'y ajoutent les **services** de la commune (liste libre, voir 3.4) et, pour chaque personne, le ou les services auxquels elle appartient : ils servent uniquement à la portée « son service ».

**Super-admin** : voit tout et peut tout faire, y compris les tickets restreints et confidentiels (il administre et opère le service). Ses consultations des tickets restreints et confidentiels sont journalisées comme les autres.

### 3.2 Fonctions

Existantes : maire, adjoint, conseiller, dgs, secretaire (libellé « Secrétaire générale / SG »), agent, agent_technique.
Ajoutées : **dst**, **accueil**, **responsable_service**.

`agent` et `agent_technique` partagent la ligne « Agent » de la matrice.

### 3.3 La matrice

Une ligne par fonction. Deux réglages de visibilité, puis des cases à cocher.

| Réglage | Valeurs |
|---|---|
| **Voit** | Rien · Ses tickets (créés, assignés, destinataire) · Son service · Toute la commune |
| **Voit les restreints** | oui / non |
| Créer · Modifier · Assigner · Changer de service · Clôturer · Rouvrir · Commenter · Changer la visibilité · Exporter | oui / non pour chacune |

Matrice par défaut proposée (modifiable par le super-admin, commune par commune) :

| Fonction | Voit | Restreints | Créer | Modifier | Assigner | Changer de service | Clôturer | Rouvrir | Commenter | Visibilité | Exporter |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Maire | Toute la commune | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DGS / SG | Toute la commune | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DST | Toute la commune | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adjoint (élu délégué) | Son service | — | ✅ | — | — | — | — | — | ✅ | — | ✅ |
| Conseiller | Ses tickets | — | ✅ | — | — | — | — | — | ✅ | — | — |
| Responsable de service | Son service | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Agent | Son service | — | ✅ | ◐ | ◐ | — | ◐ | — | ✅ | — | — |
| Accueil | Ses tickets | — | ✅ | — | — | — | — | — | ✅ | — | — |

◐ = limité aux tickets qui lui sont assignés (« prendre en charge » = s'assigner soi-même ; modifier = renseigner l'intervention).
Pour l'adjoint, « son service » = les services de sa délégation. Si une mairie veut que ses adjoints assignent les agents, le super-admin coche la case.

### 3.4 Services

Ce que je demandais au point 5 : un ticket est rattaché à un **service** de la mairie (l'équipe qui le traite), et c'est ce qui permet la portée « Son service ». Chaque mairie crée **sa propre liste** dans ses paramètres (ex. Châteauneuf : « Services techniques », « Périscolaire », « Administratif » ; une ville plus grande : « Voirie », « Espaces verts », « Bâtiments »…). Une liste de départ est proposée à l'activation et se modifie librement ; chaque catégorie de ticket pointe vers un service par défaut.

### 3.5 Confidentialité

| Niveau | Visible par |
|---|---|
| **Standard** | selon la matrice (créateur, assignés et destinataires toujours inclus) |
| **Restreint** | créateur, assignés, destinataires nommés, fonctions « Voit les restreints », super-admin |
| **Confidentiel** | créateur, destinataires nommés, super-admin |

- Restreint et confidentiel exigent au moins un destinataire nommé.
- Réassignation à un autre service : la visibilité suit (calculée à la volée).
- Journal d'audit (`audit_log`) des consultations (une entrée par personne et par jour) et des modifications des tickets restreints et confidentiels ; visible sur la fiche.
- Une seule règle, écrite à l'identique en SQL (`user_voit_ticket`, RLS, temps réel, fichiers) et en TypeScript (`peutVoirTicket`, lectures serveur), lisant la même matrice.

### 3.6 Mise en service sans rupture

À l'activation de la nouvelle version, la matrice de Châteauneuf est posée avec « Voit : Toute la commune » pour toutes les fonctions (comportement actuel). Le super-admin resserre ensuite ligne par ligne, une fois les services et leurs membres renseignés. Aucun ticket ne disparaît au déploiement.

### 3.7 Conservation des données (réglementation)

- **Les tickets sont des archives publiques** (Code du patrimoine, art. L211-4) : aucune suppression automatique des tickets. Leur durée d'utilité administrative relève des instructions de tri des archives communales (circulaire AD 93-1, instruction DAF/DPACI/RES/2009/018, instruction DGP/SIAF/2014/006) ; l'élimination se fait avec le visa des Archives départementales. L'application fournit l'export et, après visa, la purge.
- **Données sur un enfant (périscolaire)** — RGPD art. 5 (minimisation, limitation de la conservation) ; repère CNIL : norme simplifiée NS-058 (affaires scolaires et périscolaires), antérieure au RGPD mais toujours citée comme référence :
  - aucune donnée de santé dans un ticket (la fiche sanitaire ne doit pas être informatisée) : avertissement à la saisie ;
  - champ « enfant » limité au prénom et à l'initiale du nom, facultatif, visible des seuls habilités au niveau restreint ;
  - conservation limitée au temps nécessaire, sans dépasser la scolarisation de l'enfant dans la commune : **effacement automatique du champ « enfant » à la fin de l'année scolaire qui suit la clôture** (le ticket, anonymisé, reste archivé), durée réglable par commune ;
  - à faire valider par le **DPO de la commune** (obligatoire pour une collectivité, RGPD art. 37) et à inscrire au registre des traitements.
- Je n'ai pas trouvé de texte fixant une durée précise pour un incident périscolaire : la règle ci-dessus applique les principes, elle n'est pas une durée réglementaire. Le DPO tranche.

---

## 4. Architecture UX

### 4.1 Arborescence par profil

```
/admin/tickets                 Liste unique, onglets selon le profil
 ├─ Mes interventions          agent (accueil par défaut), responsable
 ├─ Mon service · Non assignés responsable
 ├─ Ma délégation              élu délégué
 ├─ Mes demandes               accueil, créateur
 └─ Tous (selon mes droits)    maire, direction
/admin/tickets/nouveau         Assistant de création (mobile d'abord)
/admin/tickets/[id]            Fiche : pièces jointes, journal, actions
/admin/tickets/[id]/cloturer   Assistant de clôture (existant)
/admin/tickets/pilotage        Tableau de bord maire / direction (remplace /stats)
/admin/tickets/carte           Carte (existante, filtrée par droits)
/admin/tickets/parametres      Services et membres, catégories, délais, sites, conservation, page publique
/<commune>/interventions       Tableau de bord PUBLIC pour les habitants (option par commune, sans connexion)
```

**Écran d'arrivée** (lancement PWA et connexion), si le module Tickets est actif :

| Profil | Arrive sur |
|---|---|
| Agent | Mes interventions |
| Responsable de service | Mon service (file + non assignés) |
| Élu délégué | Ma délégation |
| Accueil | Mes demandes + bouton « Nouvelle demande » |
| Maire / direction | Tableau de bord général (existant), avec le bloc « Interventions » en tête renvoyant au pilotage |

`pwa-launch.html` redirigera vers `/admin` qui choisit la destination côté serveur (au lieu du `/admin/dashboard` codé en dur).

### 4.2 Flux de création (mobile)

```
[+ Nouveau]  (bouton flottant toujours visible)
  1. Catégorie (grille d'icônes) → sous-catégorie
       · « Odeur de gaz » → écran d'urgence (112 / numéro gaz configurable) avant de continuer
  2. Urgence : faible · normale · urgente · danger immédiat
  3. Photo(s) — appareil photo direct
  4. Localisation — GPS automatique, déplaçable sur la carte, adresse inverse
  5. Description (titre proposé depuis la sous-catégorie)
  6. Confidentialité : standard (par défaut de la catégorie) · restreint · confidentiel
       · restreint / confidentiel → choix des destinataires nommés
     Champs propres à la catégorie (périscolaire : site, créneau, enfant, famille informée)
  7. Récapitulatif → Envoyer
       · service pré-rempli depuis la catégorie (modifiable par qui en a le droit)
       · hors ligne → « En attente d'envoi » dans la liste, envoi automatique au retour du réseau
```

L'accueil commence par le demandeur (nom, téléphone, email) puis suit le même flux.

### 4.3 Flux de traitement

```
Nouveau ──(responsable assigne / agent prend en charge)──▶ Pris en charge
   │                                                          │
   │  danger immédiat non pris en charge > 1 h : alerte       ▼
   │  responsable + direction                              En cours ──▶ En attente
   │                                                          │        (pièce, tiers,
   │  « Transmis à » (Enedis, opérateur, Département…)        │         gestionnaire externe)
   │  + date : le ticket reste suivi, délai suspendu          ▼
   └──────────────▶ Annulé                              Clôture (rapport + photo/document)
                                                              │
                                                    Rouvert (responsable, direction, maire)
```

Actions rapides depuis la liste (agent) : **Prendre en charge**, **Ajouter une photo**, **Clôturer**.

---

## 5. Schéma de données cible

Toutes les migrations : idempotentes, retour arrière dans `supabase/rollback/`, FK vers `profiles` en `on delete set null` et nommées dans les embeds, vues en `security_invoker`, suppression logique (`deleted_at`).

### 5.1 Nouvelles tables

| Table | Colonnes principales |
|---|---|
| `services` | `commune_id`, `code`, `nom`, `couleur`, `icone`, `ordre`, `actif`, `deleted_at` |
| `service_membres` | `service_id`, `profile_id` — PK (service, profil) ; pour un adjoint = sa délégation |
| `ticket_matrice` | `commune_id`, `fonction`, `voit` (`rien` · `siens` · `service` · `commune`), `voit_restreints`, une colonne booléenne par action — PK (commune, fonction) ; éditée par le super-admin |
| `ticket_categories` | `commune_id`, `parent_id` (NULL = catégorie), `code`, `libelle`, `icone`, `service_defaut_id`, `confidentialite_defaut`, `urgence_defaut`, `delai_cible_heures` (SLA), `gestionnaire_externe` (suggestion), `consigne_urgence` (ex. gaz), `champs` (jsonb : champs propres), `actif`, `ordre` |
| `ticket_destinataires` | `ticket_id`, `profile_id`, `ajoute_par`, `ajoute_le` |
| `zones` | `commune_id`, `nom`, `contour` (GeoJSON) — quartiers dessinés dans les paramètres, pour les totaux par quartier de la page publique ; sans zone, la carte publique est masquée |
| `sites` | `commune_id`, `nom`, `type` (école, accueil de loisirs, restaurant scolaire, bâtiment…), `adresse`, `lat`, `lng` — réutilisable pour les bâtiments |
| `ticket_periscolaire` | `ticket_id` (PK), `site_id`, `creneau` (matin · midi · soir · mercredi · vacances), `enfant` (texte, facultatif), `famille_informee`, `famille_informee_le`, `donnees_purgees_le` — table séparée pour une RLS plus stricte et une purge ciblée |

La taxonomie du brief (16 catégories, ~90 sous-catégories) est écrite une fois dans `src/lib/tickets/taxonomie.ts` et **copiée dans la commune** à l'activation du module (et par migration pour Châteauneuf) : chaque commune l'administre ensuite librement.

### 5.2 Colonnes ajoutées à `tickets`

`service_id`, `categorie_id` (sous-catégorie ou catégorie), `confidentialite` (`standard` · `restreint` · `confidentiel`), `urgence` (`faible` · `normale` · `urgente` · `danger_immediat`), `delai_cible_le` (calculé à la création depuis la catégorie), `transmis_a`, `transmis_le`, `transmis_reference`.

`categorie` (enum) et `priorite` sont **conservées et synchronisées par déclencheur** pendant la transition (l'ancien code continue de fonctionner jusqu'au déploiement), puis retirées dans un lot de ménage ultérieur.

`commune_settings` : `tickets_public_actif` (booléen, désactivé par défaut), `tickets_public_categories` (catégories publiées), `tickets_sans_reponse_jours`, `tickets_danger_delai_minutes`, `tickets_conservation_enfant` (par défaut : fin de l'année scolaire suivant la clôture). Ajout aux fonctions autorisées de `profiles.job_title` : `dst`, `accueil`, `responsable_service`.

### 5.3 Reprise des 103 tickets existants

| Ancien | Nouveau |
|---|---|
| `voirie` | Voirie & circulation (sans sous-catégorie) |
| `signalisation` | Voirie & circulation › Signalisation |
| `espaces_verts` | Espaces verts & nature |
| `batiment` | Bâtiments communaux |
| `eclairage_public` | Éclairage public |
| `proprete` | Propreté & déchets |
| `mobilier_urbain` | Mobilier urbain |
| `reseaux_eau` | Eau & assainissement |
| `autre` (28) | Autre — à requalifier (écran de requalification en masse proposé, avec suggestion par mots-clés) |
| priorité basse / normale / haute / urgente | urgence faible / normale / urgente / urgente (aucun ticket ancien n'est classé « danger immédiat » d'office) |
| — | confidentialité **standard** pour tous ; service = service par défaut de la catégorie |

Essai à blanc en production (transaction annulée) avant application, comme pour les migrations précédentes.

### 5.4 Sécurité au niveau base

- Policies `tickets` et tables filles réécrites avec `user_voit_ticket()` (le temps réel en hérite automatiquement).
- Bucket `tickets-photos` : plus de lecture directe ; lecture par la route serveur du lot 6.
- `tickets_reporting_v` et toute agrégation : exclusion des confidentiels.

---

## 6. Plan de livraison

| Lot | Contenu | Estimation |
|---|---|---|
| **6 — Pièces jointes** | Route d'accès stable avec contrôle des droits, visionneuse photo, PDF en nouvel onglet, miniatures, lecture directe du bucket fermée, limite de 100 corrigée, tests | 1,5 j |
| **1 — Droits** | Migration fonctions / services / membres / matrice / destinataires / confidentialité, `user_voit_ticket` + `peutVoirTicket`, RLS, filtrage de toutes les lectures serveur (liste, carte, stats, PDF, dashboard, notifications, temps réel), journal d'audit, écran super-admin de la matrice, écran Services et membres, tests de la matrice | 3 j |
| **2 — Catégories** | Taxonomie, reprise des 103 tickets, écran d'administration, pré-assignation au service, urgence, « transmis à », délais cibles, requalification des « Autre », tests | 2 j |
| **3 — PWA** | Accueil par profil, onglets, bouton flottant, actions rapides, nouvel assistant de création, file hors ligne (IndexedDB, photos comprises, envoi au retour du réseau — iOS n'a pas de Background Sync : envoi à l'ouverture et au retour en ligne), tests | 4 j |
| **4 — Pilotage** | Vue direction (maquette 4B) : alertes, compteurs, tableau des services dépliable par catégorie, carte, filtres, export CSV/PDF, confidentiels exclus et restreints masqués, tests | 2,5 j |
| **4 bis — Page publique** | Tableau de bord habitants (maquette 4A publique) : activation et choix des thèmes par commune, chiffres agrégés calculés chaque nuit (aucune donnée nominative, ni titre, ni adresse), totaux par quartier, export CSV, tests | 1,5 j |
| **5 — Périscolaire** | Service et catégorie, sites, champs propres, restreint par défaut, remontée direction/maire, purge des données enfant, tests | 1,5 j |

Total indicatif : **16 jours**. Un commit par lot, tests Vitest pour toute la logique pure (règles de visibilité, matrice, reprise, délais, file hors ligne), vérification dans le navigateur en format mobile.

Ordre de déploiement : les migrations des lots 1 et 2 sont additives et appliquées avec le code ; la matrice de départ reproduit l'accès actuel (voir 3.6).

---

## 7. Décisions validées (2026-11-07)

1. SG = direction ; fonctions DST, accueil et responsable de service ajoutées ; **matrice fonction × action réglable par commune par le super-admin**.
2. Super-admin : accès à tout.
3. Accès au module décidé par le super-admin, utilisateur par utilisateur ; conseillers = une ligne de la matrice. Modèle volontairement minimal.
4. Assignation par l'élu délégué : selon la matrice de la commune.
5. Services : liste propre à chaque mairie (voir 3.4).
6. Conservation : conforme à la réglementation (voir 3.7), à valider par le DPO.
7. Maquettes : canevas Claude Design, 10 propositions sur 4 écrans.

### Phase 2 — maquettes

Canevas Claude Design : https://claude.ai/artifact/QZKvizU313cQ3x8tR19qwC (privé). Charte réelle de l'application (Montserrat, azur `#2F6FDB`, marine `#042F64`), données d'exemple inspirées des tickets de Châteauneuf, noms de personnes fictifs, chiffres illustratifs.

**Directions retenues le 2026-11-07**

| Écran | Retenu | Ajustements |
|---|---|---|
| 1. Mes interventions (PWA) | **1A** liste groupée par urgence | — |
| 2. Création (PWA) | **2A** une question par écran | Étapes 3 (photos et lieu) et 4 (description, champs périscolaire) dessinées ; consigne d'urgence gaz reprise de 2B ; écran d'envoi hors ligne repris de 2C |
| 3. Fiche ticket | **3A** onglets | Onglets Détails, Pièces jointes (avec visionneuse) et Journal, en bureau et mobile |
| 4. Pilotage direction | **4B** alertes d'abord + tableau des services | — |
| 4 bis. Page publique | **4A** adaptée | Tableau de bord pour les habitants, activable par commune : chiffres agrégés, thèmes choisis par la commune, totaux par quartier, contact mairie |

Non retenues (conservées sur le canevas pour mémoire) : 1B, 1C, 2B, 2C, 3B, 4A interne.
