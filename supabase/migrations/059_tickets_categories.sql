-- ═══════════════════════════════════════════════════════════════
-- 059 — Signalements : catégories, urgence, délai cible, transmission (lot 2)
--
-- • `ticket_categories` : taxonomie catégorie → sous-catégorie PROPRE À
--   CHAQUE COMMUNE (copiée à l'activation, puis administrée librement),
--   avec service par défaut (pré-assignation), urgence et confidentialité
--   par défaut, délai cible (heures), gestionnaire extérieur suggéré et
--   consigne d'urgence (ex. odeur de gaz).
-- • `tickets.urgence` : faible · normale · urgente · danger_immediat.
-- • `tickets.delai_cible_le` : calculé depuis la catégorie (création ou
--   changement de catégorie). Les signalements existants n'en ont pas.
-- • `tickets.transmis_a|transmis_le|transmis_reference` : gestionnaire
--   extérieur (Enedis, opérateur, Département…).
--
-- Transition sans rupture : les colonnes historiques `categorie` (enum)
-- et `priorite` restent renseignées par déclencheur, dans les deux sens,
-- pour l'ancien code et les écrans pas encore migrés (stats, PDF, carte).
--   priorite → urgence : basse→faible, normale→normale, haute→urgente,
--                        urgente→urgente (jamais « danger » d'office)
--   urgence → priorite : faible→basse, normale→normale, urgente→haute,
--                        danger_immediat→urgente
--
-- Idempotente. Retour arrière : supabase/rollback/059_tickets_categories_down.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Taxonomie ────────────────────────────────────────────────
create table if not exists public.ticket_categories (
  id                     uuid primary key default gen_random_uuid(),
  commune_id             uuid not null references public.communes(id) on delete cascade,
  parent_id              uuid references public.ticket_categories(id) on delete cascade,
  code                   text not null,
  libelle                text not null check (btrim(libelle) <> ''),
  icone                  text,
  ordre                  integer not null default 0,
  actif                  boolean not null default true,
  service_defaut_id      uuid references public.services(id) on delete set null,
  urgence_defaut         text check (urgence_defaut in ('faible', 'normale', 'urgente', 'danger_immediat')),
  confidentialite_defaut text check (confidentialite_defaut in ('standard', 'restreint', 'confidentiel')),
  delai_cible_heures     integer check (delai_cible_heures is null or delai_cible_heures > 0),
  gestionnaire_externe   text,
  consigne_urgence       text,
  code_legacy            public.ticket_categorie,
  created_at             timestamptz not null default now(),
  deleted_at             timestamptz
);
create unique index if not exists ux_ticket_categories_code
  on public.ticket_categories(commune_id, code) where deleted_at is null;
create index if not exists idx_ticket_categories_parent on public.ticket_categories(parent_id);

alter table public.ticket_categories enable row level security;
drop policy if exists "ticket_categories_select_commune" on public.ticket_categories;
create policy "ticket_categories_select_commune"
  on public.ticket_categories for select
  using (public.user_can_access_commune(commune_id));
-- Écriture : service role uniquement (paramètres du module).

-- Taxonomie de départ (brief du 2026-11-07). Délais en heures.
create or replace function public.ticket_categories_seed(p_commune uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_parent uuid;
  gaz text := 'Mettez-vous en sécurité : n''allumez ni flamme ni interrupteur, ne téléphonez pas sur place, éloignez les personnes. Appelez Urgence Sécurité Gaz (GRDF) au 0 800 47 33 33, puis le 112 si nécessaire.';
  cable text := 'Ne touchez pas le câble et éloignez les personnes. Appelez le dépannage Enedis de votre département (09 726 750 suivi du numéro du département), ou le 112 en cas de danger.';
begin
  -- Catégories : code, libellé, icône, ordre, legacy, délai, gestionnaire
  for r in select * from (values
    ('voirie',        'Voirie & circulation',             'route',          1, 'voirie',          120, 'Département (routes départementales)'),
    ('eclairage',     'Éclairage public',                 'lightbulb',      2, 'eclairage_public', 168, 'Syndicat d''énergie'),
    ('proprete',      'Propreté & déchets',               'trash-2',        3, 'proprete',         72, 'Intercommunalité (collecte)'),
    ('espaces_verts', 'Espaces verts & nature',           'trees',          4, 'espaces_verts',   168, null),
    ('animaux',       'Animaux',                          'paw-print',      5, 'autre',            48, 'Fourrière / SPA'),
    ('eau',           'Eau & assainissement',             'droplets',       6, 'reseaux_eau',      48, 'Syndicat des eaux / délégataire'),
    ('batiments',     'Bâtiments communaux',              'building-2',     7, 'batiment',        120, null),
    ('reseaux',       'Réseaux & télécoms',               'wifi',           8, 'autre',            48, 'Enedis, GRDF ou opérateur télécom'),
    ('mobilier',      'Mobilier urbain',                  'armchair',       9, 'mobilier_urbain', 168, null),
    ('cimetiere',     'Cimetière',                        'flower-2',      10, 'autre',           168, null),
    ('securite',      'Sécurité & tranquillité',          'shield',        11, 'autre',            48, 'Gendarmerie / police'),
    ('periscolaire',  'Périscolaire & scolaire',          'school',        12, 'autre',            48, null),
    ('evenementiel',  'Événementiel & logistique',        'tent',          13, 'autre',           168, null),
    ('informatique',  'Informatique & numérique interne', 'monitor',       14, 'autre',            72, null),
    ('administratif', 'Administratif / demande interne',  'file-text',     15, 'autre',           168, null),
    ('autre',         'Autre',                            'circle-help',   16, 'autre',           null, null)
  ) as t(code, libelle, icone, ordre, legacy, delai, gestionnaire)
  loop
    insert into public.ticket_categories (commune_id, code, libelle, icone, ordre, code_legacy, delai_cible_heures, gestionnaire_externe)
    values (p_commune, r.code, r.libelle, r.icone, r.ordre, r.legacy::public.ticket_categorie, r.delai, r.gestionnaire)
    on conflict (commune_id, code) where deleted_at is null do nothing;
  end loop;

  -- Sous-catégories : parent, code, libellé, ordre, urgence, délai, confidentialité, legacy, gestionnaire, consigne
  for r in select * from (values
    ('voirie', 'nid_de_poule',         'Nid-de-poule',                        1, null,              null, null,        null,           null::text, null::text),
    ('voirie', 'chaussee_degradee',    'Chaussée dégradée',                   2, null,              null, null,        null,           null, null),
    ('voirie', 'signalisation',        'Signalisation (panneau, marquage)',   3, null,              null, null,        'signalisation', null, null),
    ('voirie', 'feu_tricolore',        'Feu tricolore',                       4, 'urgente',          24, null,        'signalisation', null, null),
    ('voirie', 'trottoir',             'Trottoir',                            5, null,              null, null,        null,           null, null),
    ('voirie', 'stationnement_genant', 'Stationnement gênant',                6, null,              null, null,        null,           'Police municipale / gendarmerie', null),
    ('voirie', 'ralentisseur',         'Ralentisseur',                        7, null,              null, null,        null,           null, null),
    ('voirie', 'deneigement',          'Déneigement, salage',                 8, 'urgente',          24, null,        null,           null, null),
    ('eclairage', 'lampadaire_panne',    'Lampadaire en panne',               1, null,              null, null,        null,           null, null),
    ('eclairage', 'eclairage_permanent', 'Éclairage allumé en permanence',    2, null,              null, null,        null,           null, null),
    ('eclairage', 'cable_apparent',      'Câble apparent',                    3, 'danger_immediat',    4, null,        null,           null, null),
    ('proprete', 'depot_sauvage',  'Dépôt sauvage',                           1, null,              null, null,        null,           null, null),
    ('proprete', 'poubelle',       'Poubelle pleine ou cassée',               2, null,              null, null,        null,           null, null),
    ('proprete', 'encombrants',    'Encombrants',                             3, null,              null, null,        null,           null, null),
    ('proprete', 'tags',           'Tags, graffitis',                         4, null,              null, null,        null,           null, null),
    ('proprete', 'dejections',     'Déjections canines',                      5, null,              null, null,        null,           null, null),
    ('proprete', 'conteneurs_tri', 'Conteneurs de tri',                       6, null,              null, null,        null,           null, null),
    ('espaces_verts', 'elagage',          'Élagage',                          1, null,              null, null,        null,           null, null),
    ('espaces_verts', 'arbre_dangereux',  'Arbre dangereux ou tombé',         2, 'urgente',          24, null,        null,           null, null),
    ('espaces_verts', 'tonte_desherbage', 'Tonte, désherbage',                3, null,              null, null,        null,           null, null),
    ('espaces_verts', 'frelons',          'Frelons, nid d''insectes',         4, 'urgente',          48, null,        null,           null, null),
    ('espaces_verts', 'haie',             'Haie débordante',                  5, null,              null, null,        null,           null, null),
    ('animaux', 'chien_errant',    'Chien errant',                            1, 'urgente',          24, null,        null,           null, null),
    ('animaux', 'chat_errant',     'Chat errant',                             2, null,              null, null,        null,           null, null),
    ('animaux', 'animal_blesse',   'Animal blessé ou mort sur la voie',       3, 'urgente',           4, null,        null,           null, null),
    ('animaux', 'nuisances_animaux','Nuisances (aboiements…)',                4, null,              null, null,        null,           null, null),
    ('animaux', 'nuisibles',       'Animaux nuisibles (rats, pigeons)',       5, null,              null, null,        null,           null, null),
    ('eau', 'fuite',          'Fuite d''eau',                                 1, 'urgente',           4, null,        null,           null, null),
    ('eau', 'egout_bouche',   'Bouche d''égout bouchée',                      2, null,              null, null,        null,           null, null),
    ('eau', 'inondation',     'Inondation',                                   3, 'danger_immediat',    1, null,        null,           null, null),
    ('eau', 'odeurs',         'Odeurs',                                       4, null,              null, null,        null,           null, null),
    ('eau', 'fosse_busage',   'Fossé, busage',                                5, null,              null, null,        null,           null, null),
    ('eau', 'borne_incendie', 'Borne incendie',                               6, 'urgente',          24, null,        null,           'SDIS', null),
    ('batiments', 'chauffage',      'Chauffage',                              1, 'urgente',          24, null,        null,           null, null),
    ('batiments', 'electricite',    'Électricité',                            2, null,              null, null,        null,           null, null),
    ('batiments', 'plomberie',      'Plomberie',                              3, null,              null, null,        null,           null, null),
    ('batiments', 'serrurerie',     'Serrurerie',                             4, null,              null, null,        null,           null, null),
    ('batiments', 'toiture',        'Toiture, infiltration',                  5, null,              null, null,        null,           null, null),
    ('batiments', 'vitrage',        'Vitrage',                                6, null,              null, null,        null,           null, null),
    ('batiments', 'accessibilite',  'Accessibilité PMR',                      7, null,              null, null,        null,           null, null),
    ('batiments', 'menage',         'Ménage',                                 8, null,              null, null,        null,           null, null),
    ('reseaux', 'fibre_internet',   'Fibre, internet',                        1, null,              null, null,        null,           'Opérateur télécom', null),
    ('reseaux', 'telephonie',       'Téléphonie',                             2, null,              null, null,        null,           'Opérateur télécom', null),
    ('reseaux', 'panne_electrique', 'Panne électrique du secteur',            3, 'urgente',           4, null,        null,           'Enedis', null),
    ('reseaux', 'poteau_incline',   'Poteau incliné',                         4, 'urgente',          24, null,        null,           'Enedis ou opérateur télécom', null),
    ('reseaux', 'cable_tombe',      'Câble tombé',                            5, 'danger_immediat',    1, null,        null,           'Enedis ou opérateur télécom', 'CABLE'),
    ('reseaux', 'odeur_gaz',        'Odeur de gaz',                           6, 'danger_immediat',    1, null,        null,           'GRDF', 'GAZ'),
    ('mobilier', 'banc',              'Banc',                                 1, null,              null, null,        null,           null, null),
    ('mobilier', 'abribus',           'Abribus',                              2, null,              null, null,        null,           null, null),
    ('mobilier', 'panneau_affichage', 'Panneau d''affichage',                 3, null,              null, null,        null,           null, null),
    ('mobilier', 'jeux_enfants',      'Jeux pour enfants',                    4, 'urgente',          24, null,        null,           null, null),
    ('mobilier', 'barriere',          'Barrière',                             5, null,              null, null,        null,           null, null),
    ('mobilier', 'borne',             'Borne',                                6, null,              null, null,        null,           null, null),
    ('cimetiere', 'concession',       'Concession',                           1, null,              null, null,        null,           null, null),
    ('cimetiere', 'entretien',        'Entretien',                            2, null,              null, null,        null,           null, null),
    ('cimetiere', 'degradation',      'Dégradation',                          3, null,              null, null,        null,           null, null),
    ('securite', 'nuisances_sonores', 'Nuisances sonores',                    1, null,              null, null,        null,           null, null),
    ('securite', 'vehicule_epave',    'Véhicule épave',                       2, null,              null, null,        null,           'Fourrière', null),
    ('securite', 'squat',             'Squat',                                3, null,              null, 'restreint', null,           'Gendarmerie / police', null),
    ('securite', 'depot_dangereux',   'Dépôt dangereux',                      4, 'urgente',           4, null,        null,           null, null),
    ('securite', 'incivilite',        'Incivilité',                           5, null,              null, null,        null,           null, null),
    ('securite', 'vitesse_excessive', 'Vitesse excessive',                    6, null,              null, null,        null,           null, null),
    ('periscolaire', 'incident_enfant',    'Incident enfant',                 1, 'urgente',          24, 'restreint', null,           null, null),
    ('periscolaire', 'materiel_cantine',   'Matériel cantine / garderie',     2, null,              null, null,        null,           null, null),
    ('periscolaire', 'batiment_ecole',     'Bâtiment école',                  3, null,              null, null,        null,           null, null),
    ('periscolaire', 'transport_scolaire', 'Transport scolaire',              4, null,              null, null,        null,           'Région (transports scolaires)', null),
    ('periscolaire', 'hygiene',            'Hygiène, restauration',           5, 'urgente',          24, null,        null,           null, null),
    ('evenementiel', 'pret_materiel',   'Prêt de matériel (tables, barnums)', 1, null,              null, null,        null,           null, null),
    ('evenementiel', 'montage',         'Montage, démontage',                 2, null,              null, null,        null,           null, null),
    ('evenementiel', 'salle',           'Mise à disposition de salle',        3, null,              null, null,        null,           null, null),
    ('informatique', 'poste',     'Poste de travail',                         1, null,              null, null,        null,           null, null),
    ('informatique', 'imprimante','Imprimante',                               2, null,              null, null,        null,           null, null),
    ('informatique', 'logiciel',  'Logiciel',                                 3, null,              null, null,        null,           null, null),
    ('informatique', 'acces',     'Accès, mot de passe',                      4, null,              null, null,        null,           null, null),
    ('informatique', 'site_web',  'Site web',                                 5, null,              null, null,        null,           null, null),
    ('administratif', 'courrier',   'Courrier',                               1, null,              null, null,        null,           null, null),
    ('administratif', 'rh',         'Ressources humaines',                    2, null,              null, 'confidentiel', null,        null, null),
    ('administratif', 'achats',     'Achats',                                 3, null,              null, null,        null,           null, null),
    ('administratif', 'note_maire', 'Note au maire',                          4, null,              null, 'restreint', null,           null, null),
    ('administratif', 'rendez_vous','Demande de rendez-vous',                 5, null,              null, 'restreint', null,           null, null),
    ('administratif', 'signature',  'Signature, parapheur',                   6, null,              null, null,        null,           null, null)
  ) as t(parent, code, libelle, ordre, urgence, delai, confidentialite, legacy, gestionnaire, consigne)
  loop
    select id into v_parent from public.ticket_categories
     where commune_id = p_commune and code = r.parent and parent_id is null and deleted_at is null;
    if v_parent is null then continue; end if;
    insert into public.ticket_categories (
      commune_id, parent_id, code, libelle, ordre, urgence_defaut, delai_cible_heures,
      confidentialite_defaut, code_legacy, gestionnaire_externe, consigne_urgence
    ) values (
      p_commune, v_parent, r.code, r.libelle, r.ordre, r.urgence, r.delai,
      r.confidentialite, r.legacy::public.ticket_categorie, r.gestionnaire,
      case r.consigne when 'GAZ' then gaz when 'CABLE' then cable else null end
    )
    on conflict (commune_id, code) where deleted_at is null do nothing;
  end loop;
end $$;
revoke all on function public.ticket_categories_seed(uuid) from public, anon, authenticated;

-- Toutes les communes existantes, puis toute nouvelle commune
do $$
declare c record;
begin
  for c in select id from public.communes loop
    perform public.ticket_categories_seed(c.id);
  end loop;
end $$;

create or replace function public.tg_communes_ticket_categories()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ticket_categories_seed(new.id);
  return new;
end $$;
drop trigger if exists trg_communes_ticket_categories on public.communes;
create trigger trg_communes_ticket_categories
  after insert on public.communes
  for each row execute function public.tg_communes_ticket_categories();

-- ─── 2. Colonnes des signalements ─────────────────────────────────
alter table public.tickets
  add column if not exists categorie_id       uuid references public.ticket_categories(id) on delete set null,
  add column if not exists urgence            text,
  add column if not exists delai_cible_le     timestamptz,
  add column if not exists transmis_a         text,
  add column if not exists transmis_le        date,
  add column if not exists transmis_reference text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tickets_urgence_check') then
    alter table public.tickets add constraint tickets_urgence_check
      check (urgence in ('faible', 'normale', 'urgente', 'danger_immediat'));
  end if;
end $$;
create index if not exists idx_tickets_categorie_id on public.tickets(categorie_id);
create index if not exists idx_tickets_urgence on public.tickets(commune_id, urgence);

-- ─── 3. Reprise des signalements existants (avant le déclencheur :
--        aucun délai cible n'est inventé pour l'historique) ─────────
update public.tickets t
   set urgence = case t.priorite when 'basse' then 'faible' when 'normale' then 'normale' else 'urgente' end
 where t.urgence is null;

update public.tickets t
   set categorie_id = c.id
  from public.ticket_categories c
 where t.categorie_id is null
   and c.commune_id = t.commune_id
   and c.deleted_at is null
   and c.code = case t.categorie::text
                  when 'voirie'           then 'voirie'
                  when 'signalisation'    then 'signalisation'
                  when 'espaces_verts'    then 'espaces_verts'
                  when 'batiment'         then 'batiments'
                  when 'eclairage_public' then 'eclairage'
                  when 'proprete'         then 'proprete'
                  when 'mobilier_urbain'  then 'mobilier'
                  when 'reseaux_eau'      then 'eau'
                  else 'autre'
                end;

alter table public.tickets alter column urgence set not null;
alter table public.tickets alter column urgence set default 'normale';

-- ─── 4. Synchronisation catégorie ↔ enum, urgence ↔ priorité, délai ──
create or replace function public.tickets_sync_categorie_urgence()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_legacy public.ticket_categorie;
  v_delai integer;
  v_id uuid;
begin
  -- Urgence ↔ priorité historique
  if tg_op = 'INSERT' then
    if new.urgence is null or (new.urgence = 'normale' and new.priorite is distinct from 'normale') then
      new.urgence := case new.priorite when 'basse' then 'faible' when 'normale' then 'normale' else 'urgente' end;
    else
      new.priorite := case new.urgence when 'faible' then 'basse' when 'normale' then 'normale' when 'urgente' then 'haute' else 'urgente' end;
    end if;
  elsif new.urgence is distinct from old.urgence then
    new.priorite := case new.urgence when 'faible' then 'basse' when 'normale' then 'normale' when 'urgente' then 'haute' else 'urgente' end;
  elsif new.priorite is distinct from old.priorite then
    new.urgence := case new.priorite when 'basse' then 'faible' when 'normale' then 'normale' else 'urgente' end;
  end if;

  -- Ancien code : seule la catégorie historique est fournie ou modifiée
  if new.categorie_id is null and tg_op = 'INSERT'
     or (tg_op = 'UPDATE' and new.categorie is distinct from old.categorie and new.categorie_id is not distinct from old.categorie_id) then
    select c.id into v_id
      from public.ticket_categories c
     where c.commune_id = new.commune_id and c.deleted_at is null and c.code_legacy = new.categorie
     order by (c.code = new.categorie::text) desc, (c.parent_id is null) desc, c.ordre
     limit 1;
    if v_id is not null then new.categorie_id := v_id; end if;
  end if;

  -- Catégorie → enum historique et délai cible
  if new.categorie_id is not null and (tg_op = 'INSERT' or new.categorie_id is distinct from old.categorie_id) then
    select coalesce(c.code_legacy, p.code_legacy, 'autre'), coalesce(c.delai_cible_heures, p.delai_cible_heures)
      into v_legacy, v_delai
      from public.ticket_categories c
      left join public.ticket_categories p on p.id = c.parent_id
     where c.id = new.categorie_id;
    if found then
      new.categorie := v_legacy;
      new.delai_cible_le := case when v_delai is null then null
                                 else coalesce(new.created_at, now()) + make_interval(hours => v_delai) end;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_tickets_sync_categorie_urgence on public.tickets;
create trigger trg_tickets_sync_categorie_urgence
  before insert or update on public.tickets
  for each row execute function public.tickets_sync_categorie_urgence();
