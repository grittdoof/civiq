-- ═══════════════════════════════════════════════════════════════
-- Migration 005 — Template "Vie associative" + activation modules
--
-- Idempotente : rejouable sans danger.
--   • Insère un template public "Fiche de liaison vie associative"
--     (5 étapes, 18 champs)
--   • Active le module 'budget' (beta) pour toutes les communes
--     existantes — peut être désactivé manuellement ensuite.
-- ═══════════════════════════════════════════════════════════════

-- ─── Template Vie associative ────────────────────────────────
insert into public.survey_templates (id, title, description, category, is_public, schema)
values (
  '00000000-0000-0000-0000-000000000a01'::uuid,
  'Fiche de liaison — Vie associative & culturelle',
  'Recense les besoins, événements et attentes des associations communales pour préparer le calendrier annuel et la programmation de soutien municipal.',
  'associations',
  true,
  jsonb_build_object(
    'settings', jsonb_build_object(
      'estimated_time', '8 min',
      'allow_anonymous', false,
      'show_progress', true,
      'require_email', true
    ),
    'steps', jsonb_build_array(
      -- Étape 1 — Identité
      jsonb_build_object(
        'id', 'identite',
        'title', 'Identité de votre structure',
        'description', 'Présentez l''association ou la structure que vous représentez.',
        'fields', jsonb_build_array(
          jsonb_build_object('id', 'nom_structure', 'type', 'text',     'label', 'Nom de l''association ou structure', 'required', true,  'placeholder', 'Ex : Les Amis du Patrimoine'),
          jsonb_build_object('id', 'forme',         'type', 'radio',    'label', 'Type de structure', 'required', true,
            'options', jsonb_build_array(
              jsonb_build_object('value', 'asso',         'label', 'Association loi 1901'),
              jsonb_build_object('value', 'entreprise',   'label', 'Entreprise / Auto-entrepreneur'),
              jsonb_build_object('value', 'collectif',    'label', 'Collectif informel'),
              jsonb_build_object('value', 'autre',        'label', 'Autre')
            )
          ),
          jsonb_build_object('id', 'domaine', 'type', 'radio', 'label', 'Domaine d''activité principal', 'required', true,
            'options', jsonb_build_array(
              jsonb_build_object('value', 'sport',     'label', 'Sport'),
              jsonb_build_object('value', 'culture',   'label', 'Culture'),
              jsonb_build_object('value', 'loisirs',   'label', 'Loisirs'),
              jsonb_build_object('value', 'social',    'label', 'Social / Solidarité'),
              jsonb_build_object('value', 'patrimoine','label', 'Patrimoine'),
              jsonb_build_object('value', 'jeunesse',  'label', 'Jeunesse / Éducation'),
              jsonb_build_object('value', 'env',       'label', 'Environnement'),
              jsonb_build_object('value', 'autre',     'label', 'Autre')
            )
          ),
          jsonb_build_object('id', 'adherents', 'type', 'number', 'label', 'Nombre d''adhérents', 'min', 0, 'max', 10000),
          jsonb_build_object('id', 'site',      'type', 'text',   'label', 'Site internet / Réseaux sociaux', 'placeholder', 'https:// ou @pseudo')
        )
      ),
      -- Étape 2 — Contacts
      jsonb_build_object(
        'id', 'contacts',
        'title', 'Vos contacts privilégiés',
        'description', 'Personnes que la mairie pourra solliciter en priorité.',
        'fields', jsonb_build_array(
          jsonb_build_object('id', 'president',     'type', 'text',  'label', 'Président·e', 'required', true),
          jsonb_build_object('id', 'president_tel', 'type', 'tel',   'label', 'Téléphone du / de la président·e'),
          jsonb_build_object('id', 'referent',      'type', 'text',  'label', 'Référent·e opérationnel·le (si différent·e)'),
          jsonb_build_object('id', 'referent_tel',  'type', 'tel',   'label', 'Téléphone du / de la référent·e'),
          jsonb_build_object('id', 'email',         'type', 'email', 'label', 'Email de contact officiel', 'required', true)
        )
      ),
      -- Étape 3 — Calendrier
      jsonb_build_object(
        'id', 'calendrier',
        'title', 'Calendrier de l''année',
        'description', 'Indiquez vos événements majeurs (fêtes, spectacles, tournois, randonnées…). Vous pourrez compléter ultérieurement.',
        'fields', jsonb_build_array(
          jsonb_build_object('id', 'evenements',     'type', 'textarea', 'label', 'Liste des événements prévus', 'hint', 'Un événement par ligne avec date et lieu si possible. Ex : « Fête de la musique — 21 juin — place du marché »', 'placeholder', 'Événement 1 — date — lieu&#10;Événement 2 — date — lieu'),
          jsonb_build_object('id', 'evenement_phare','type', 'text',     'label', 'Votre événement phare de l''année'),
          jsonb_build_object('id', 'public_estime',  'type', 'number',   'label', 'Public estimé sur l''ensemble des événements', 'min', 0)
        )
      ),
      -- Étape 4 — Besoins & ressources
      jsonb_build_object(
        'id', 'besoins',
        'title', 'Vos besoins et ressources',
        'description', 'Pour mieux organiser le soutien logistique et matériel.',
        'fields', jsonb_build_array(
          jsonb_build_object('id', 'salles', 'type', 'radio', 'label', 'Utilisez-vous les salles municipales ?', 'required', true,
            'options', jsonb_build_array(
              jsonb_build_object('value', 'oui_souvent',  'label', 'Oui, régulièrement (chaque semaine)'),
              jsonb_build_object('value', 'oui_ponctuel', 'label', 'Oui, ponctuellement'),
              jsonb_build_object('value', 'non',          'label', 'Non')
            )
          ),
          jsonb_build_object('id', 'salles_frequence', 'type', 'text', 'label', 'Si oui, à quelle fréquence et dans quelle salle ?',
            'conditional', jsonb_build_object('field', 'salles', 'value', jsonb_build_array('oui_souvent', 'oui_ponctuel'))
          ),
          jsonb_build_object('id', 'materiel', 'type', 'checkbox', 'label', 'Matériel municipal régulièrement utilisé',
            'options', jsonb_build_array(
              jsonb_build_object('value', 'podium',       'label', 'Podium / scène'),
              jsonb_build_object('value', 'chaises',      'label', 'Chaises / tables'),
              jsonb_build_object('value', 'sono',         'label', 'Sonorisation'),
              jsonb_build_object('value', 'barrieres',    'label', 'Barrières / Vauban'),
              jsonb_build_object('value', 'tentes',       'label', 'Tentes / chapiteaux'),
              jsonb_build_object('value', 'eclairage',    'label', 'Éclairage'),
              jsonb_build_object('value', 'autre',        'label', 'Autre (précisez en commentaires)')
            )
          ),
          jsonb_build_object('id', 'subvention', 'type', 'radio', 'label', 'Sollicitez-vous une subvention municipale cette année ?',
            'options', jsonb_build_array(
              jsonb_build_object('value', 'oui_renouv',   'label', 'Oui, renouvellement'),
              jsonb_build_object('value', 'oui_nouvelle', 'label', 'Oui, nouvelle demande'),
              jsonb_build_object('value', 'non',          'label', 'Non')
            )
          ),
          jsonb_build_object('id', 'benevoles', 'type', 'radio', 'label', 'Recherchez-vous des bénévoles ?',
            'options', jsonb_build_array(
              jsonb_build_object('value', 'oui',     'label', 'Oui, activement'),
              jsonb_build_object('value', 'parfois', 'label', 'Ponctuellement'),
              jsonb_build_object('value', 'non',     'label', 'Non')
            )
          )
        )
      ),
      -- Étape 5 — Communication & attentes
      jsonb_build_object(
        'id', 'attentes',
        'title', 'Communication & attentes',
        'description', 'Les supports de la mairie pour vous aider à toucher les habitants.',
        'fields', jsonb_build_array(
          jsonb_build_object('id', 'communication', 'type', 'checkbox', 'label', 'Supports de communication souhaités',
            'options', jsonb_build_array(
              jsonb_build_object('value', 'bulletin',    'label', 'Bulletin municipal'),
              jsonb_build_object('value', 'panneaux',    'label', 'Panneaux lumineux'),
              jsonb_build_object('value', 'reseaux',     'label', 'Réseaux sociaux municipaux'),
              jsonb_build_object('value', 'depliant',    'label', 'Dépliant office du tourisme'),
              jsonb_build_object('value', 'site',        'label', 'Site internet de la mairie'),
              jsonb_build_object('value', 'newsletter',  'label', 'Newsletter aux habitants')
            )
          ),
          jsonb_build_object('id', 'priorites', 'type', 'checkbox', 'label', 'Vos priorités pour cette année', 'columns', 2,
            'options', jsonb_build_array(
              jsonb_build_object('value', 'locaux',       'label', 'Amélioration des locaux'),
              jsonb_build_object('value', 'subventions',  'label', 'Aide aux subventions'),
              jsonb_build_object('value', 'benevoles',    'label', 'Recrutement de bénévoles'),
              jsonb_build_object('value', 'mutualisation','label', 'Mutualisation entre associations'),
              jsonb_build_object('value', 'visibilite',   'label', 'Visibilité accrue'),
              jsonb_build_object('value', 'formations',   'label', 'Formations'),
              jsonb_build_object('value', 'partenariats', 'label', 'Partenariats avec écoles')
            )
          ),
          jsonb_build_object('id', 'commentaire', 'type', 'textarea', 'label', 'Un mot, une suggestion, un projet à partager ?', 'placeholder', 'Vos remarques libres…')
        )
      )
    )
  )
)
on conflict (id) do update set
  title       = excluded.title,
  description = excluded.description,
  category    = excluded.category,
  schema      = excluded.schema,
  is_public   = excluded.is_public;

-- ─── Activer le module budget (beta) pour les communes existantes ──
-- Optionnel — la commune peut le retirer ensuite depuis super-admin
insert into public.commune_modules (commune_id, module_id)
select id, 'budget' from public.communes
on conflict do nothing;
