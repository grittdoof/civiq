-- ═══════════════════════════════════════════════════════════════
-- CIVIQ — Seed : Commune de Châteauneuf + Sondage périscolaire
-- Source : sondage-periscolaire-chateauneuf.html (6 étapes)
--
-- Instructions :
--   1. Ouvrir Supabase → SQL Editor
--   2. Coller et exécuter ce script ENTIER
--   3. Copier les UUIDs retournés pour configurer la connexion admin
--
-- Note : ce script est idempotent (ON CONFLICT DO NOTHING / DO UPDATE)
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_commune_id uuid;
  v_survey_id  uuid;
  v_template_id uuid;
  v_survey_schema jsonb;
BEGIN

-- ════════════════════════════════════════════════════════════════
-- 1. COMMUNE DE CHÂTEAUNEUF
-- ════════════════════════════════════════════════════════════════
INSERT INTO public.communes (
  name, slug, code_postal, departement,
  primary_color, accent_color,
  contact_email,
  settings
)
VALUES (
  'Châteauneuf',
  'chateauneuf-85',
  '85710',
  'Vendée',
  '#1a2744',
  '#c9a84c',
  'mairie@chateauneuf-85.fr',
  '{"region": "Pays de la Loire", "nb_habitants": 2800}'
)
ON CONFLICT (slug) DO UPDATE
  SET name         = EXCLUDED.name,
      primary_color = EXCLUDED.primary_color,
      accent_color  = EXCLUDED.accent_color
RETURNING id INTO v_commune_id;

RAISE NOTICE 'Commune id : %', v_commune_id;

-- ════════════════════════════════════════════════════════════════
-- 2. SCHEMA JSON DU SONDAGE
--    Fidèle au HTML original : 6 étapes, ~25 questions
-- ════════════════════════════════════════════════════════════════
v_survey_schema := jsonb_build_object(
  'settings', jsonb_build_object(
    'show_progress',   true,
    'allow_anonymous', true,
    'estimated_time',  '5 min'
  ),
  'steps', jsonb_build_array(

    -- ──────────────────────────────────────────────
    -- ÉTAPE 1 : Votre foyer
    -- ──────────────────────────────────────────────
    jsonb_build_object(
      'id',          'foyer',
      'title',       'Votre foyer',
      'icon',        '👨‍👩‍👧‍👦',
      'description', 'Quelques informations pour mieux comprendre votre situation',
      'fields', jsonb_build_array(

        jsonb_build_object(
          'id',       'nb_enfants',
          'type',     'select',
          'label',    'Nombre d''enfants scolarisés',
          'required', true,
          'options',  jsonb_build_array(
            jsonb_build_object('value','1',   'label','1 enfant'),
            jsonb_build_object('value','2',   'label','2 enfants'),
            jsonb_build_object('value','3',   'label','3 enfants'),
            jsonb_build_object('value','4+',  'label','4 enfants ou plus')
          )
        ),

        jsonb_build_object(
          'id',       'niveaux',
          'type',     'checkbox_grid',
          'label',    'Niveaux de classe concernés',
          'hint',     'Cochez tous les niveaux qui vous concernent',
          'required', true,
          'columns',  2,
          'options',  jsonb_build_array(
            jsonb_build_object('value','maternelle_ps', 'label','Petite section',         'sublabel','Maternelle'),
            jsonb_build_object('value','maternelle_ms', 'label','Moyenne section',        'sublabel','Maternelle'),
            jsonb_build_object('value','maternelle_gs', 'label','Grande section',         'sublabel','Maternelle'),
            jsonb_build_object('value','cp',            'label','CP',                     'sublabel','Élémentaire'),
            jsonb_build_object('value','ce1',           'label','CE1',                    'sublabel','Élémentaire'),
            jsonb_build_object('value','ce2',           'label','CE2',                    'sublabel','Élémentaire'),
            jsonb_build_object('value','cm1',           'label','CM1',                    'sublabel','Élémentaire'),
            jsonb_build_object('value','cm2',           'label','CM2',                    'sublabel','Élémentaire'),
            jsonb_build_object('value','college',       'label','Collège (6e–3e)',         'sublabel','Établissement extérieur'),
            jsonb_build_object('value','lycee',         'label','Lycée (2nde–Terminale)', 'sublabel','Établissement extérieur')
          )
        ),

        jsonb_build_object(
          'id',      'situation_pro',
          'type',    'radio',
          'label',   'Situation professionnelle du foyer',
          'hint',    'Cela nous aide à comprendre vos contraintes horaires',
          'options', jsonb_build_array(
            jsonb_build_object('value','deux_actifs',  'label','Deux parents en activité'),
            jsonb_build_object('value','un_actif',     'label','Un parent en activité'),
            jsonb_build_object('value','monoparental', 'label','Famille monoparentale'),
            jsonb_build_object('value','autre',        'label','Autre situation')
          )
        )

      ) -- end fields étape 1
    ), -- end étape 1

    -- ──────────────────────────────────────────────
    -- ÉTAPE 2 : Services actuels
    -- ──────────────────────────────────────────────
    jsonb_build_object(
      'id',          'services_actuels',
      'title',       'Services actuels',
      'icon',        '🍽',
      'description', 'Votre utilisation de l''offre périscolaire existante',
      'fields', jsonb_build_array(

        jsonb_build_object(
          'id',       'services_actuels',
          'type',     'checkbox',
          'label',    'Quels services utilisez-vous actuellement ?',
          'required', true,
          'options',  jsonb_build_array(
            jsonb_build_object('value','cantine',       'label','🍽 Cantine le midi'),
            jsonb_build_object('value','garderie_soir', 'label','🌙 Accueil du soir (après l''école)'),
            jsonb_build_object('value','aucun',         'label','Aucun de ces services')
          )
        ),

        jsonb_build_object(
          'id',        'satisfaction_actuelle',
          'type',      'scale',
          'label',     'Satisfaction globale vis-à-vis des services actuels',
          'min',       1,
          'max',       5,
          'min_label', 'Pas satisfait',
          'max_label', 'Très satisfait'
        ),

        jsonb_build_object(
          'id',          'commentaire_actuel',
          'type',        'textarea',
          'label',       'Commentaire ou suggestion sur les services actuels',
          'placeholder', 'Horaires, qualité des repas, encadrement…'
        )

      ) -- end fields étape 2
    ), -- end étape 2

    -- ──────────────────────────────────────────────
    -- ÉTAPE 3 : Vos besoins futurs
    -- ──────────────────────────────────────────────
    jsonb_build_object(
      'id',          'besoins_futurs',
      'title',       'Vos besoins futurs',
      'icon',        '✨',
      'description', 'Les services que vous aimeriez voir se développer',
      'fields', jsonb_build_array(

        jsonb_build_object(
          'id',       'mercredi_apm',
          'type',     'radio',
          'label',    'Accueil le mercredi après-midi',
          'hint',     'Activités encadrées de type centre de loisirs',
          'required', true,
          'options',  jsonb_build_array(
            jsonb_build_object('value','oui_regulier',  'label','Oui, chaque semaine',    'sublabel','Besoin régulier tous les mercredis'),
            jsonb_build_object('value','oui_ponctuel',  'label','Oui, ponctuellement',    'sublabel','Quelques mercredis par mois'),
            jsonb_build_object('value','non',           'label','Non, pas de besoin'),
            jsonb_build_object('value','ne_sais_pas',   'label','Je ne sais pas encore')
          )
        ),

        jsonb_build_object(
          'id',       'vacances',
          'type',     'checkbox',
          'label',    'Accueil pendant les vacances scolaires',
          'hint',     'Centre de loisirs / activités pendant les congés',
          'required', true,
          'options',  jsonb_build_array(
            jsonb_build_object('value','toussaint', 'label','🍂 Toussaint'),
            jsonb_build_object('value','noel',      'label','🎄 Noël'),
            jsonb_build_object('value','hiver',     'label','❄️ Hiver (février)'),
            jsonb_build_object('value','printemps', 'label','🌸 Printemps (avril)'),
            jsonb_build_object('value','ete',       'label','☀️ Été (juillet-août)'),
            jsonb_build_object('value','aucun',     'label','Pas de besoin pendant les vacances')
          )
        ),

        jsonb_build_object(
          'id',      'weekend',
          'type',    'radio',
          'label',   'Accueil le week-end (samedi)',
          'hint',    'Activités sportives, culturelles, ou ateliers ponctuels',
          'options', jsonb_build_array(
            jsonb_build_object('value','oui_regulier', 'label','Oui, intéressé(e)',   'sublabel','Ateliers réguliers le samedi matin ou après-midi'),
            jsonb_build_object('value','oui_ponctuel', 'label','Ponctuellement',      'sublabel','Stages ou événements ponctuels'),
            jsonb_build_object('value','non',          'label','Non')
          )
        ),

        jsonb_build_object(
          'id',      'activites',
          'type',    'checkbox_grid',
          'label',   'Types d''activités souhaitées',
          'hint',    'Cochez celles qui intéressent votre famille',
          'columns', 2,
          'options', jsonb_build_array(
            jsonb_build_object('value','sport',     'label','⚽ Sport & motricité'),
            jsonb_build_object('value','arts',      'label','🎨 Arts plastiques & créatifs'),
            jsonb_build_object('value','nature',    'label','🌿 Nature & environnement'),
            jsonb_build_object('value','musique',   'label','🎵 Musique & spectacle'),
            jsonb_build_object('value','numerique', 'label','💻 Numérique & codage'),
            jsonb_build_object('value','cuisine',   'label','🧑‍🍳 Cuisine & alimentation'),
            jsonb_build_object('value','lecture',   'label','📚 Lecture & jeux de société'),
            jsonb_build_object('value','langues',   'label','🌍 Initiation aux langues')
          )
        )

      ) -- end fields étape 3
    ), -- end étape 3

    -- ──────────────────────────────────────────────
    -- ÉTAPE 4 : Collégiens & aide aux devoirs
    -- ──────────────────────────────────────────────
    jsonb_build_object(
      'id',          'college_devoirs',
      'title',       'Collégiens & aide aux devoirs',
      'icon',        '📖',
      'description', 'Étendre l''offre aux élèves du secondaire et soutien scolaire',
      'fields', jsonb_build_array(

        jsonb_build_object(
          'id',      'accueil_college',
          'type',    'radio',
          'label',   'Seriez-vous intéressé(e) par un accueil périscolaire pour les collégiens ?',
          'hint',    'Étude surveillée, activités, accueil le mercredi…',
          'options', jsonb_build_array(
            jsonb_build_object('value','oui_tres',   'label','Oui, c''est un vrai besoin',         'sublabel','Mon/mes enfant(s) est/sont ou sera/seront au collège'),
            jsonb_build_object('value','oui_futur',  'label','Oui, pour dans quelques années',     'sublabel','Mon enfant est encore en primaire'),
            jsonb_build_object('value','non',        'label','Non, pas concerné(e)')
          )
        ),

        jsonb_build_object(
          'id',      'aide_devoirs',
          'type',    'radio',
          'label',   'Aide aux devoirs / soutien scolaire',
          'hint',    'Un service d''accompagnement aux devoirs encadré par des bénévoles et/ou intervenants',
          'options', jsonb_build_array(
            jsonb_build_object('value','oui_primaire', 'label','Oui, pour les élèves du primaire'),
            jsonb_build_object('value','oui_college',  'label','Oui, pour les collégiens'),
            jsonb_build_object('value','oui_les_deux', 'label','Oui, pour les deux'),
            jsonb_build_object('value','non',          'label','Pas de besoin')
          )
        ),

        jsonb_build_object(
          'id',      'creneaux_devoirs',
          'type',    'checkbox_grid',
          'label',   'Créneaux préférés pour l''aide aux devoirs',
          'columns', 2,
          'options', jsonb_build_array(
            jsonb_build_object('value','apres_ecole',    'label','Après l''école (16h30–18h)'),
            jsonb_build_object('value','mercredi_matin', 'label','Mercredi matin'),
            jsonb_build_object('value','samedi_matin',   'label','Samedi matin'),
            jsonb_build_object('value','vacances',       'label','Pendant les vacances')
          )
        )

      ) -- end fields étape 4
    ), -- end étape 4

    -- ──────────────────────────────────────────────
    -- ÉTAPE 5 : Engagement & bénévolat
    -- ──────────────────────────────────────────────
    jsonb_build_object(
      'id',          'benevolat',
      'title',       'Engagement & bénévolat',
      'icon',        '🤝',
      'description', 'La vie périscolaire repose aussi sur l''implication de tous',
      'fields', jsonb_build_array(

        jsonb_build_object(
          'id',      'benevolat',
          'type',    'checkbox',
          'label',   'Seriez-vous prêt(e) à vous engager bénévolement ?',
          'hint',    'Même ponctuellement, votre aide est précieuse',
          'options', jsonb_build_array(
            jsonb_build_object('value','aide_devoirs',    'label','📝 Aide aux devoirs',            'sublabel','Accompagner les enfants dans leurs travaux scolaires'),
            jsonb_build_object('value','animation',       'label','🎭 Animation d''activités',      'sublabel','Sport, arts, musique, bricolage…'),
            jsonb_build_object('value','accompagnement',  'label','🚌 Accompagnement sorties',      'sublabel','Encadrer lors de sorties et événements'),
            jsonb_build_object('value','logistique',      'label','🔧 Logistique & organisation',   'sublabel','Aide à la mise en place, rangement, gestion'),
            jsonb_build_object('value','comite',          'label','💡 Comité de pilotage',          'sublabel','Participer aux réflexions et décisions'),
            jsonb_build_object('value','non',             'label','Pas disponible pour le moment')
          )
        ),

        jsonb_build_object(
          'id',      'dispo_benevolat',
          'type',    'radio',
          'label',   'Disponibilité pour le bénévolat',
          'options', jsonb_build_array(
            jsonb_build_object('value','regulier', 'label','Régulièrement',                    'sublabel','Une ou plusieurs fois par semaine'),
            jsonb_build_object('value','mensuel',  'label','Quelques fois par mois'),
            jsonb_build_object('value','ponctuel', 'label','Ponctuellement',                   'sublabel','Événements spécifiques'),
            jsonb_build_object('value','vacances', 'label','Pendant les vacances uniquement')
          )
        ),

        jsonb_build_object(
          'id',          'competences_benevole',
          'type',        'textarea',
          'label',       'Compétences ou savoir-faire à partager',
          'placeholder', 'Ex : ancien professeur, musicien, entraîneur sportif, bilingue anglais, bricoleur…'
        )

      ) -- end fields étape 5
    ), -- end étape 5

    -- ──────────────────────────────────────────────
    -- ÉTAPE 6 : Budget, remarques & contact
    -- ──────────────────────────────────────────────
    jsonb_build_object(
      'id',          'budget_remarques',
      'title',       'Budget, remarques & contact',
      'icon',        '💬',
      'description', 'Dernières questions pour affiner notre compréhension',
      'fields', jsonb_build_array(

        jsonb_build_object(
          'id',      'budget',
          'type',    'radio',
          'label',   'Budget acceptable pour un accueil périscolaire élargi',
          'hint',    'Par enfant et par jour, sur la base d''un tarif progressif selon le quotient familial',
          'options', jsonb_build_array(
            jsonb_build_object('value','moins_5',  'label','Moins de 5 € / jour'),
            jsonb_build_object('value','5_10',     'label','Entre 5 et 10 € / jour'),
            jsonb_build_object('value','10_15',    'label','Entre 10 et 15 € / jour'),
            jsonb_build_object('value','plus_15',  'label','Plus de 15 € / jour'),
            jsonb_build_object('value','gratuit',  'label','Uniquement si gratuit ou quasi-gratuit')
          )
        ),

        jsonb_build_object(
          'id',      'priorite',
          'type',    'select',
          'label',   'Quel est le sujet prioritaire pour votre famille ?',
          'options', jsonb_build_array(
            jsonb_build_object('value','mercredi',        'label','Accueil le mercredi'),
            jsonb_build_object('value','vacances',        'label','Accueil pendant les vacances'),
            jsonb_build_object('value','aide_devoirs',    'label','Aide aux devoirs'),
            jsonb_build_object('value','accueil_college', 'label','Accueil des collégiens'),
            jsonb_build_object('value','qualite_cantine', 'label','Amélioration de la cantine'),
            jsonb_build_object('value','horaires',        'label','Élargissement des horaires'),
            jsonb_build_object('value','autre',           'label','Autre')
          )
        ),

        jsonb_build_object(
          'id',          'remarques',
          'type',        'textarea',
          'label',       'Vos idées, remarques ou suggestions',
          'placeholder', 'Partagez librement ce qui vous semble important pour l''accueil périscolaire de nos enfants…'
        ),

        jsonb_build_object(
          'id',          'nom',
          'type',        'text',
          'label',       'Nom',
          'placeholder', 'Nom (facultatif)'
        ),

        jsonb_build_object(
          'id',          'email',
          'type',        'email',
          'label',       'Email',
          'placeholder', 'Email (facultatif)'
        ),

        jsonb_build_object(
          'id',          'telephone',
          'type',        'tel',
          'label',       'Téléphone',
          'placeholder', 'Téléphone (facultatif)'
        )

      ) -- end fields étape 6
    ) -- end étape 6

  ) -- end steps array
); -- end v_survey_schema

-- ════════════════════════════════════════════════════════════════
-- 3. TEMPLATE RÉUTILISABLE (visible par toutes les communes)
-- ════════════════════════════════════════════════════════════════
INSERT INTO public.survey_templates (
  title,
  description,
  category,
  schema,
  is_public,
  commune_id
)
VALUES (
  'Besoins périscolaires & extrascolaires',
  'Sondage complet pour identifier les besoins des familles : cantine, mercredi, vacances scolaires, week-end, aide aux devoirs, accueil des collégiens et engagement bénévole. 6 étapes, ~25 questions.',
  'periscolaire',
  v_survey_schema,
  true,
  null  -- template global, pas lié à une commune
)
ON CONFLICT DO NOTHING
RETURNING id INTO v_template_id;

RAISE NOTICE 'Template id : %', v_template_id;

-- ════════════════════════════════════════════════════════════════
-- 4. SONDAGE CONCRET POUR CHÂTEAUNEUF
--    Statut : published, clôture le 30 mai 2026
-- ════════════════════════════════════════════════════════════════
INSERT INTO public.surveys (
  commune_id,
  title,
  slug,
  description,
  schema,
  status,
  starts_at,
  ends_at,
  allow_anonymous,
  require_email,
  custom_header_text,
  custom_thank_you,
  published_at
)
VALUES (
  v_commune_id,
  'Besoins en accueil périscolaire & extrascolaire',
  'besoins-periscolaires-2026',
  'Chers parents, la municipalité souhaite mieux connaître vos besoins pour adapter et développer les services d''accueil de vos enfants. Ce sondage confidentiel prend environ 5 minutes.',
  v_survey_schema,
  'published',
  now(),
  '2026-05-30 23:59:59+02',
  true,
  false,
  'Vos besoins en accueil périscolaire & extrascolaire',
  'Vos réponses ont bien été enregistrées. Elles seront analysées par l''équipe municipale pour construire une offre périscolaire adaptée à vos besoins. Les résultats seront partagés lors d''un prochain conseil municipal.',
  now()
)
ON CONFLICT (commune_id, slug) DO UPDATE
  SET schema       = EXCLUDED.schema,
      status       = EXCLUDED.status,
      ends_at      = EXCLUDED.ends_at,
      description  = EXCLUDED.description
RETURNING id INTO v_survey_id;

RAISE NOTICE '════════════════════════════════════════════';
RAISE NOTICE 'SEED TERMINÉ AVEC SUCCÈS';
RAISE NOTICE '────────────────────────────────────────────';
RAISE NOTICE 'Commune id  : %', v_commune_id;
RAISE NOTICE 'Template id : %', v_template_id;
RAISE NOTICE 'Survey id   : %', v_survey_id;
RAISE NOTICE '────────────────────────────────────────────';
RAISE NOTICE 'URL publique du sondage :';
RAISE NOTICE '  /survey/besoins-periscolaires-2026?commune=chateauneuf-85';
RAISE NOTICE '════════════════════════════════════════════';

END $$;


-- ════════════════════════════════════════════════════════════════
-- VÉRIFICATION (optionnelle — à exécuter séparément si besoin)
-- ════════════════════════════════════════════════════════════════
/*

-- Vérifier la commune
SELECT id, name, slug, primary_color FROM communes WHERE slug = 'chateauneuf-85';

-- Vérifier le sondage
SELECT id, title, slug, status, ends_at,
       jsonb_array_length(schema->'steps') AS nb_etapes
FROM surveys WHERE slug = 'besoins-periscolaires-2026';

-- Compter les champs par étape
SELECT
  step->>'title' AS etape,
  jsonb_array_length(step->'fields') AS nb_champs
FROM surveys,
  jsonb_array_elements(schema->'steps') AS step
WHERE slug = 'besoins-periscolaires-2026';

-- Vérifier le template
SELECT id, title, category, is_public FROM survey_templates WHERE category = 'periscolaire';

*/
