-- ═══════════════════════════════════════════════════════════════
-- CIVIQ — Schema principal
-- Multi-tenant : chaque commune = un tenant
-- Row Level Security activé sur toutes les tables
-- ═══════════════════════════════════════════════════════════════

-- Extensions


-- ═══════ COMMUNES (tenants) ═══════
create table public.communes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null, -- ex: "chateauneuf-85"
  code_postal text,
  departement text,
  logo_url text,
  primary_color text default '#1a2744',
  accent_color text default '#c9a84c',
  contact_email text,
  website_url text,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══════ USERS (admins de communes) ═══════
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  commune_id uuid references public.communes(id),
  full_name text,
  role text default 'editor' check (role in ('super_admin', 'admin', 'editor', 'viewer')),
  avatar_url text,
  created_at timestamptz default now()
);

-- ═══════ SURVEYS (sondages modulaires) ═══════
create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  commune_id uuid not null references public.communes(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  -- Le schéma JSON du formulaire (questions, étapes, options)
  schema jsonb not null default '{"steps": [], "settings": {}}',
  status text default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  -- Paramètres
  starts_at timestamptz,
  ends_at timestamptz,
  allow_anonymous boolean default true,
  require_email boolean default false,
  max_responses integer,
  -- Branding override
  custom_header_text text,
  custom_thank_you text,
  -- Metadata
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz,
  -- Unicité du slug par commune
  unique(commune_id, slug)
);

-- ═══════ RESPONSES (réponses aux sondages) ═══════
create table public.responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  commune_id uuid not null references public.communes(id),
  -- Données de réponse (JSON flexible)
  data jsonb not null default '{}',
  -- Contact optionnel
  respondent_name text,
  respondent_email text,
  respondent_phone text,
  -- Metadata
  submitted_at timestamptz default now(),
  ip_hash text, -- hash anonymisé pour anti-doublon
  user_agent text,
  duration_seconds integer -- temps de remplissage
);

-- ═══════ SURVEY TEMPLATES (modèles réutilisables) ═══════
create table public.survey_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text, -- 'periscolaire', 'urbanisme', 'budget_participatif', etc.
  schema jsonb not null,
  is_public boolean default true, -- visible par toutes les communes
  commune_id uuid references public.communes(id), -- null = template global
  created_at timestamptz default now()
);

-- ═══════ INDEXES ═══════
create index idx_surveys_commune on public.surveys(commune_id);
create index idx_surveys_status on public.surveys(status);
create index idx_surveys_slug on public.surveys(commune_id, slug);
create index idx_responses_survey on public.responses(survey_id);
create index idx_responses_commune on public.responses(commune_id);
create index idx_responses_date on public.responses(submitted_at);
create index idx_profiles_commune on public.profiles(commune_id);

-- ═══════ ROW LEVEL SECURITY ═══════
alter table public.communes enable row level security;
alter table public.profiles enable row level security;
alter table public.surveys enable row level security;
alter table public.responses enable row level security;
alter table public.survey_templates enable row level security;

-- Communes : lecture publique, écriture admin
create policy "Communes are viewable by everyone"
  on public.communes for select using (true);

create policy "Communes are editable by their admins"
  on public.communes for update using (
    id in (
      select commune_id from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('admin', 'super_admin')
    )
  );

-- Profiles : accès par commune
create policy "Profiles are viewable by same commune"
  on public.profiles for select using (
    commune_id in (
      select commune_id from public.profiles where id = auth.uid()
    )
  );

create policy "Users can update own profile"
  on public.profiles for update using (id = auth.uid());

-- Surveys : lecture publique si published, écriture par commune
create policy "Published surveys are viewable by everyone"
  on public.surveys for select using (status = 'published');

create policy "All surveys viewable by commune members"
  on public.surveys for select using (
    commune_id in (
      select commune_id from public.profiles where id = auth.uid()
    )
  );

create policy "Surveys are editable by commune editors"
  on public.surveys for all using (
    commune_id in (
      select commune_id from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('admin', 'super_admin', 'editor')
    )
  );

-- Responses : insertion anonyme, lecture par commune
create policy "Anyone can submit responses to published surveys"
  on public.responses for insert with check (
    survey_id in (select id from public.surveys where status = 'published')
  );

create policy "Responses are viewable by commune members"
  on public.responses for select using (
    commune_id in (
      select commune_id from public.profiles where id = auth.uid()
    )
  );

-- Templates : lecture publique, écriture admin
create policy "Public templates are viewable by everyone"
  on public.survey_templates for select using (is_public = true);

create policy "Commune templates viewable by members"
  on public.survey_templates for select using (
    commune_id in (
      select commune_id from public.profiles where id = auth.uid()
    )
  );

-- ═══════ FUNCTIONS ═══════

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_survey_update
  before update on public.surveys
  for each row execute function public.handle_updated_at();

create trigger on_commune_update
  before update on public.communes
  for each row execute function public.handle_updated_at();

-- Stats agrégées pour un sondage (évite de charger toutes les réponses)
create or replace function public.get_survey_stats(p_survey_id uuid)
returns json as $$
declare
  result json;
begin
  select json_build_object(
    'total_responses', count(*),
    'first_response', min(submitted_at),
    'last_response', max(submitted_at),
    'avg_duration', round(avg(duration_seconds))
  ) into result
  from public.responses
  where survey_id = p_survey_id;
  
  return result;
end;
$$ language plpgsql security definer;

-- ═══════ SEED DATA : Template périscolaire ═══════
insert into public.survey_templates (title, description, category, schema) values (
  'Besoins périscolaires et extrascolaires',
  'Sondage complet pour identifier les besoins des familles en matière d''accueil périscolaire, extrascolaire, aide aux devoirs et bénévolat.',
  'periscolaire',
  '{
    "settings": {
      "allow_anonymous": true,
      "show_progress": true,
      "estimated_time": "5 minutes"
    },
    "steps": [
      {
        "id": "foyer",
        "title": "Votre foyer",
        "icon": "users",
        "description": "Quelques informations pour mieux comprendre votre situation",
        "fields": [
          {
            "id": "nb_enfants",
            "type": "select",
            "label": "Nombre d''enfants scolarisés",
            "required": true,
            "options": [
              {"value": "1", "label": "1 enfant"},
              {"value": "2", "label": "2 enfants"},
              {"value": "3", "label": "3 enfants"},
              {"value": "4+", "label": "4 enfants ou plus"}
            ]
          },
          {
            "id": "niveaux",
            "type": "checkbox_grid",
            "label": "Niveaux de classe concernés",
            "required": true,
            "hint": "Cochez tous les niveaux qui vous concernent",
            "columns": 2,
            "options": [
              {"value": "maternelle_ps", "label": "Petite section", "sublabel": "Maternelle"},
              {"value": "maternelle_ms", "label": "Moyenne section", "sublabel": "Maternelle"},
              {"value": "maternelle_gs", "label": "Grande section", "sublabel": "Maternelle"},
              {"value": "cp", "label": "CP", "sublabel": "Élémentaire"},
              {"value": "ce1", "label": "CE1", "sublabel": "Élémentaire"},
              {"value": "ce2", "label": "CE2", "sublabel": "Élémentaire"},
              {"value": "cm1", "label": "CM1", "sublabel": "Élémentaire"},
              {"value": "cm2", "label": "CM2", "sublabel": "Élémentaire"},
              {"value": "college", "label": "Collège (6e-3e)", "sublabel": "Établissement extérieur"},
              {"value": "lycee", "label": "Lycée (2nde-Terminale)", "sublabel": "Établissement extérieur"}
            ]
          },
          {
            "id": "situation_pro",
            "type": "radio",
            "label": "Situation professionnelle du foyer",
            "hint": "Cela nous aide à comprendre vos contraintes horaires",
            "options": [
              {"value": "deux_actifs", "label": "Deux parents en activité"},
              {"value": "un_actif", "label": "Un parent en activité"},
              {"value": "monoparental", "label": "Famille monoparentale"},
              {"value": "autre", "label": "Autre situation"}
            ]
          }
        ]
      },
      {
        "id": "services_actuels",
        "title": "Services actuels",
        "icon": "utensils",
        "description": "Votre utilisation de l''offre périscolaire existante",
        "fields": [
          {
            "id": "services_utilises",
            "type": "checkbox",
            "label": "Quels services utilisez-vous actuellement ?",
            "required": true,
            "options": [
              {"value": "cantine", "label": "Cantine le midi", "icon": "utensils"},
              {"value": "garderie_soir", "label": "Accueil du soir", "icon": "moon"},
              {"value": "aucun", "label": "Aucun de ces services"}
            ]
          },
          {
            "id": "satisfaction",
            "type": "scale",
            "label": "Satisfaction globale",
            "min": 1,
            "max": 5,
            "min_label": "Pas satisfait",
            "max_label": "Très satisfait"
          },
          {
            "id": "commentaire_actuel",
            "type": "textarea",
            "label": "Commentaires ou suggestions",
            "placeholder": "Horaires, qualité des repas, encadrement…"
          }
        ]
      },
      {
        "id": "nouveaux_besoins",
        "title": "Vos besoins futurs",
        "icon": "sparkles",
        "description": "Les services que vous aimeriez voir se développer",
        "fields": [
          {
            "id": "mercredi_apm",
            "type": "radio",
            "label": "Accueil le mercredi après-midi",
            "required": true,
            "hint": "Activités encadrées de type centre de loisirs",
            "options": [
              {"value": "oui_regulier", "label": "Oui, chaque semaine", "sublabel": "Besoin régulier"},
              {"value": "oui_ponctuel", "label": "Oui, ponctuellement", "sublabel": "Quelques mercredis par mois"},
              {"value": "non", "label": "Non, pas de besoin"},
              {"value": "ne_sais_pas", "label": "Je ne sais pas encore"}
            ]
          },
          {
            "id": "vacances",
            "type": "checkbox",
            "label": "Accueil pendant les vacances scolaires",
            "required": true,
            "options": [
              {"value": "toussaint", "label": "Toussaint"},
              {"value": "noel", "label": "Noël"},
              {"value": "hiver", "label": "Hiver (février)"},
              {"value": "printemps", "label": "Printemps (avril)"},
              {"value": "ete", "label": "Été (juillet-août)"},
              {"value": "aucun", "label": "Pas de besoin"}
            ]
          },
          {
            "id": "weekend",
            "type": "radio",
            "label": "Accueil le week-end (samedi)",
            "options": [
              {"value": "oui_regulier", "label": "Oui, intéressé(e)"},
              {"value": "oui_ponctuel", "label": "Ponctuellement"},
              {"value": "non", "label": "Non"}
            ]
          },
          {
            "id": "activites",
            "type": "checkbox_grid",
            "label": "Types d''activités souhaitées",
            "columns": 2,
            "options": [
              {"value": "sport", "label": "Sport & motricité", "icon": "dumbbell"},
              {"value": "arts", "label": "Arts plastiques & créatifs", "icon": "palette"},
              {"value": "nature", "label": "Nature & environnement", "icon": "leaf"},
              {"value": "musique", "label": "Musique & spectacle", "icon": "music"},
              {"value": "numerique", "label": "Numérique & codage", "icon": "laptop"},
              {"value": "cuisine", "label": "Cuisine & alimentation", "icon": "chef-hat"},
              {"value": "lecture", "label": "Lecture & jeux de société", "icon": "book-open"},
              {"value": "langues", "label": "Initiation aux langues", "icon": "globe"}
            ]
          }
        ]
      },
      {
        "id": "college_devoirs",
        "title": "Collégiens & aide aux devoirs",
        "icon": "book-open",
        "description": "Étendre l''offre au secondaire et soutien scolaire",
        "fields": [
          {
            "id": "accueil_college",
            "type": "radio",
            "label": "Accueil périscolaire pour les collégiens ?",
            "options": [
              {"value": "oui_tres", "label": "Oui, c''est un vrai besoin"},
              {"value": "oui_futur", "label": "Oui, pour dans quelques années"},
              {"value": "non", "label": "Non, pas concerné(e)"}
            ]
          },
          {
            "id": "aide_devoirs",
            "type": "radio",
            "label": "Aide aux devoirs / soutien scolaire",
            "options": [
              {"value": "oui_primaire", "label": "Oui, pour le primaire"},
              {"value": "oui_college", "label": "Oui, pour les collégiens"},
              {"value": "oui_les_deux", "label": "Oui, pour les deux"},
              {"value": "non", "label": "Pas de besoin"}
            ]
          },
          {
            "id": "creneaux_devoirs",
            "type": "checkbox_grid",
            "label": "Créneaux préférés",
            "columns": 2,
            "options": [
              {"value": "apres_ecole", "label": "Après l''école (16h30-18h)"},
              {"value": "mercredi_matin", "label": "Mercredi matin"},
              {"value": "samedi_matin", "label": "Samedi matin"},
              {"value": "vacances", "label": "Pendant les vacances"}
            ]
          }
        ]
      },
      {
        "id": "benevolat",
        "title": "Engagement & bénévolat",
        "icon": "heart-handshake",
        "description": "La vie périscolaire repose aussi sur l''implication de tous",
        "fields": [
          {
            "id": "types_benevolat",
            "type": "checkbox",
            "label": "Prêt(e) à vous engager ?",
            "options": [
              {"value": "aide_devoirs", "label": "Aide aux devoirs", "sublabel": "Accompagner les enfants"},
              {"value": "animation", "label": "Animation d''activités", "sublabel": "Sport, arts, musique…"},
              {"value": "accompagnement", "label": "Accompagnement sorties"},
              {"value": "logistique", "label": "Logistique & organisation"},
              {"value": "comite", "label": "Comité de pilotage"},
              {"value": "non", "label": "Pas disponible"}
            ]
          },
          {
            "id": "dispo_benevolat",
            "type": "radio",
            "label": "Disponibilité",
            "options": [
              {"value": "regulier", "label": "Régulièrement"},
              {"value": "mensuel", "label": "Quelques fois par mois"},
              {"value": "ponctuel", "label": "Ponctuellement"},
              {"value": "vacances", "label": "Pendant les vacances uniquement"}
            ]
          },
          {
            "id": "competences",
            "type": "textarea",
            "label": "Compétences ou savoir-faire à partager",
            "placeholder": "Ex : ancien professeur, musicien, entraîneur sportif…"
          }
        ]
      },
      {
        "id": "conclusion",
        "title": "Budget, remarques & contact",
        "icon": "message-circle",
        "description": "Dernières questions",
        "fields": [
          {
            "id": "budget",
            "type": "radio",
            "label": "Budget acceptable par enfant / jour",
            "options": [
              {"value": "moins_5", "label": "Moins de 5 €"},
              {"value": "5_10", "label": "Entre 5 et 10 €"},
              {"value": "10_15", "label": "Entre 10 et 15 €"},
              {"value": "plus_15", "label": "Plus de 15 €"},
              {"value": "gratuit", "label": "Uniquement si gratuit"}
            ]
          },
          {
            "id": "priorite",
            "type": "select",
            "label": "Sujet prioritaire pour votre famille",
            "options": [
              {"value": "mercredi", "label": "Accueil le mercredi"},
              {"value": "vacances", "label": "Accueil pendant les vacances"},
              {"value": "aide_devoirs", "label": "Aide aux devoirs"},
              {"value": "accueil_college", "label": "Accueil des collégiens"},
              {"value": "qualite_cantine", "label": "Amélioration de la cantine"},
              {"value": "horaires", "label": "Élargissement des horaires"},
              {"value": "autre", "label": "Autre"}
            ]
          },
          {
            "id": "remarques",
            "type": "textarea",
            "label": "Vos idées, remarques ou suggestions",
            "placeholder": "Partagez librement…"
          },
          {
            "id": "nom",
            "type": "text",
            "label": "Nom (facultatif)"
          },
          {
            "id": "email",
            "type": "email",
            "label": "Email (facultatif)"
          },
          {
            "id": "telephone",
            "type": "tel",
            "label": "Téléphone (facultatif)"
          }
        ]
      }
    ]
  }'
);
