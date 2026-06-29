# Processus projet — Les 7 phases et leurs livrables

Document de travail pour relire et amender le contenu narratif du module Projet.

Source de vérité technique : [`src/lib/projects/types.ts`](../src/lib/projects/types.ts) — constante `PROJECT_PHASE_GUIDE`.

---

## Vue d'ensemble

| # | Phase | Phrase courte | Nb livrables |
|---|-------|---------------|--------------|
| 1 | **Émergence** | Fiche d'opportunité, premières études d'idée | 4 |
| 2 | **Faisabilité & cadrage** | Étude de faisabilité, scénarios, pré-chiffrage | 4 |
| 3 | **Décision & budget** | PPI, délibération de principe, vote du budget | 4 |
| 4 | **Recherche de financement** | Demandes de subventions, plan de financement | 4 |
| 5 | **Conception & marchés** | Maîtrise d'œuvre, marchés publics | 4 |
| 6 | **Réalisation** | Travaux et livraisons | 4 |
| 7 | **Bilan & clôture** | Bilan financier et clôture administrative | 4 |

### Légende des types de livrable

| Type (`kind`) | Comportement UI | Auto-détecté si… |
|---------------|-----------------|------------------|
| `identity` | Formulaire titre + description + objectifs + photo | Le projet a un titre ≠ « Sans titre » |
| `document` | Zone d'upload + liste des docs attachés | ≥ 1 document est attaché au projet |
| `stakeholder` | Form ajout/sélection d'une partie prenante + rôle RACI | ≥ 1 partie prenante est associée |
| `financing` | Form ligne de financement (financeur, dispositif, montant, statut, dates) | ≥ 1 ligne de financement existe |
| `milestone` | Form jalon (libellé, échéance, responsable) | ≥ 1 jalon est défini |
| `field` | Champ(s) spécifique(s) selon `link` (pilotes, lifecycle, bilan) | Le champ projet correspondant est rempli |
| `task` | Toggle « fait / pas fait » + note libre | Coche manuelle uniquement |

---

# Phase 1 · Émergence

### Contexte d'entrée (vous arrivez avec)
> Une idée, un besoin du terrain, un signalement.

### Objectif de la phase
> Caractériser l'opportunité pour décider si elle mérite d'être étudiée. C'est l'étape la moins coûteuse — le rôle ici est de cadrer et trier.

### Livrables à produire

| # | Libellé | Type | Lien fiche |
|---|---------|------|------------|
| 1 | Identité du projet : titre, description, objectifs, photo. | `identity` | — |
| 2 | Fiche d'opportunité (1 page) : enjeu, public visé, ordre de grandeur du budget. | `document` | Documents |
| 3 | Désignation d'un pilote élu et d'un pilote agent. | `field` | Objectifs (pilotes) |
| 4 | Avis informel des parties prenantes clés. | `stakeholder` | Parties prenantes |

### Porte de sortie (pour passer à la phase 2)
> Le projet est jugé suffisamment pertinent pour engager une étude de faisabilité.

---

# Phase 2 · Faisabilité & cadrage

### Contexte d'entrée
> Une fiche d'opportunité validée et des pilotes désignés.

### Objectif de la phase
> Vérifier que le projet est techniquement faisable, juridiquement compétent et économiquement soutenable. C'est l'étape qui transforme une idée en programme.

### Livrables à produire

| # | Libellé | Type | Lien fiche |
|---|---------|------|------------|
| 1 | Étude de faisabilité (technique, juridique, financière). | `document` | Documents |
| 2 | Plusieurs scénarios chiffrés avec leurs coûts globaux sur 10 ans. | `field` | Coûts 10 ans |
| 3 | Pré-identification des financeurs potentiels. | `financing` | Plan de financement |
| 4 | Compétence confirmée (communale / intercommunale / partagée). | `task` | — |

### Porte de sortie (pour passer à la phase 3)
> Un scénario est sélectionné par les élus et est prêt à être délibéré.

---

# Phase 3 · Décision & budget

### Contexte d'entrée
> Un scénario chiffré et un coût global sur 10 ans documenté.

### Objectif de la phase
> Engager la commune politiquement et budgétairement. Une fois le budget voté, le projet est officiel et son périmètre est verrouillé.

### Livrables à produire

| # | Libellé | Type | Lien fiche |
|---|---------|------|------------|
| 1 | Délibération de principe au Conseil municipal. | `document` | Documents |
| 2 | Inscription du projet au PPI (Plan Pluriannuel d'Investissement). | `task` | — |
| 3 | Autorisation de programme et crédits de paiement votés. | `milestone` | Étapes clés |
| 4 | Information publique du lancement. | `task` | — |

### Porte de sortie (pour passer à la phase 4)
> Le budget est voté et les crédits sont disponibles pour engager la suite.

---

# Phase 4 · Recherche de financement

### Contexte d'entrée
> Un budget voté et des financeurs identifiés.

### Objectif de la phase
> Sécuriser le tour de table financier AVANT d'engager juridiquement les marchés. Toute notification de marché avant l'AR du dossier compromet l'éligibilité.

### Livrables à produire

| # | Libellé | Type | Lien fiche |
|---|---------|------|------------|
| 1 | Dépôt des dossiers de subvention (DETR, DSIL, Département, Région…). | `financing` | Plan de financement |
| 2 | Accusés de réception (AR) des dossiers complets. | `task` | — |
| 3 | Notifications d'attribution ou de refus. | `task` | — |
| 4 | Plan de financement consolidé et validé. | `financing` | Plan de financement |

### Porte de sortie (pour passer à la phase 5)
> Porte de financement : autofinancement assumé OU au moins 1 subvention notifiée. Aucun marché ne doit être notifié tant que l'AR n'est pas reçu.

---

# Phase 5 · Conception & marchés

### Contexte d'entrée
> Un financement sécurisé et la porte de financement franchie.

### Objectif de la phase
> Designer le projet (maîtrise d'œuvre) et passer les marchés de travaux dans le respect de la commande publique.

### Livrables à produire

| # | Libellé | Type | Lien fiche |
|---|---------|------|------------|
| 1 | Désignation du maître d'œuvre. | `stakeholder` | Parties prenantes |
| 2 | APS, APD, PRO (avant-projet sommaire, définitif, projet). | `document` | Documents |
| 3 | Publication des marchés de travaux (BOAMP/JOUE). | `milestone` | Étapes clés |
| 4 | Analyse des offres et attribution. | `document` | Documents |

### Porte de sortie (pour passer à la phase 6)
> Les marchés de travaux sont notifiés et l'ordre de service peut être donné.

---

# Phase 6 · Réalisation

### Contexte d'entrée
> Marchés notifiés. L'éligibilité subventions est ici la plus exposée — vérifier les antériorités.

### Objectif de la phase
> Piloter le chantier jusqu'à la réception. L'objectif est de tenir le triptyque coût / délai / qualité tout en gardant trace pour le bilan.

### Livrables à produire

| # | Libellé | Type | Lien fiche |
|---|---------|------|------------|
| 1 | Ordre de service de démarrage. | `milestone` | Étapes clés |
| 2 | Comptes-rendus de chantier réguliers. | `document` | Documents |
| 3 | Avenants éventuels approuvés. | `document` | Documents |
| 4 | PV de réception et levée des réserves. | `document` | Documents |

### Porte de sortie (pour passer à la phase 7)
> Les travaux sont réceptionnés et la garantie de parfait achèvement court.

---

# Phase 7 · Bilan & clôture

### Contexte d'entrée
> Un ouvrage réceptionné et toutes les factures soldées.

### Objectif de la phase
> Tirer les enseignements du projet : coût réel vs prévu, retours d'usage, transmission aux futures équipes. C'est l'étape la plus oubliée et la plus utile pour la suite.

### Livrables à produire

| # | Libellé | Type | Lien fiche |
|---|---------|------|------------|
| 1 | Coût réel saisi et écart vs budget initial expliqué. | `field` | Bilan |
| 2 | Bilan d'utilisation (premiers mois d'exploitation). | `document` | Documents |
| 3 | Archivage des pièces administratives. | `document` | Documents |
| 4 | Réintégration des données de coût d'exploitation au PPI futur. | `task` | — |

### Porte de sortie
> Le bilan est validé et le projet peut être archivé sereinement.

---

## Comment utiliser ce document pour proposer des amendements

Pour chaque phase, vous pouvez retravailler **5 éléments** :

1. **Contexte d'entrée** (`arrivedWith`) — phrase courte qui dit ce qui devrait déjà être fait quand on entre dans cette phase. C'est rassurant pour l'utilisateur.
2. **Objectif** (`objective`) — paragraphe qui répond à « C'est quoi cette étape ? ». 1-3 phrases max.
3. **Liste des livrables** — ajouter, supprimer, réordonner, reformuler. Pour chaque livrable :
   - Le libellé (affiché à l'utilisateur)
   - Le type (`kind`) qui détermine le formulaire affiché
   - Le lien optionnel vers la section concernée de la fiche
4. **Porte de sortie** (`gate`) — phrase qui définit ce qui doit être vrai pour passer à la phase suivante.

Une fois vos amendements écrits, je les reporte dans `PROJECT_PHASE_GUIDE` dans `src/lib/projects/types.ts`. Tout le reste (UI, PDF, auto-détection, progression) se met à jour automatiquement à partir de cette source unique.

---

## Notes techniques pour la rédaction

- Les libellés de livrable apparaissent **mot pour mot** dans l'UI et le PDF — visez la concision et la clarté pour un non-spécialiste.
- L'ordre des livrables dans la liste = ordre de l'utilisateur dans le flow. Le premier livrable d'une phase est ce qu'il fera en premier.
- Si un livrable existant doit basculer d'un `kind` à un autre, ça revient à changer le formulaire affiché. Possible mais demande une vérification de cohérence (un livrable `document` ne peut pas devenir `financing` sans casser la logique d'auto-détection).
- Pour ajouter un nouveau `kind` (ex : `vote` pour les délibérations), il faut aussi étendre `DeliverableKind` et créer le formulaire correspondant dans `DeliverablePage.tsx`. Je m'en charge sur indication.
