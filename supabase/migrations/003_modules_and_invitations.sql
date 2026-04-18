-- ═══════════════════════════════════════════════════════════════
-- CIVIQ — Modules + Invitations multi-admin
--
-- Architecture évolutive :
-- - SUPER_ADMIN gère la plateforme (modules disponibles, communes)
-- - Chaque commune (espace) a un ou plusieurs ADMIN/EDITOR
-- - Chaque commune active des modules à la carte
-- ═══════════════════════════════════════════════════════════════

-- ═══════ 1. MODULES (catalogue plateforme) ═══════
-- Liste de tous les modules disponibles sur la plateforme
create table public.modules (
  id text primary key,                    -- ex: 'surveys', 'budget'
  name text not null,                     -- ex: 'Sondages citoyens'
  tagline text,                           -- accroche courte
  description text,                       -- description détaillée
  icon text,                              -- nom icône lucide
  category text,                          -- ex: 'consultation', 'gestion'
  is_available boolean default true,      -- visible dans le catalogue
  is_beta boolean default false,
  display_order integer default 0,
  created_at timestamptz default now()
);

-- Seed des modules de base
insert into public.modules (id, name, tagline, description, icon, category, display_order) values
  ('surveys',
   'Sondages citoyens',
   'Consultez vos administrés en quelques clics',
   'Créez des sondages multi-étapes avec 11 types de questions, partagez un lien public, et exportez les résultats en CSV. Idéal pour les consultations périscolaires, urbanisme, satisfaction.',
   'clipboard-list',
   'consultation',
   1),
  ('budget',
   'Budget participatif',
   'Donnez la parole aux citoyens sur le budget',
   'Permettez aux citoyens de proposer des projets et de voter pour ceux qu''ils souhaitent voir financer. Suivi du budget et des dépenses en temps réel.',
   'piggy-bank',
   'consultation',
   2),
  ('events',
   'Événements municipaux',
   'Inscriptions et gestion des événements',
   'Publiez les événements de votre commune (fêtes, conseils municipaux, ateliers) et gérez les inscriptions en ligne.',
   'calendar-days',
   'gestion',
   3),
  ('alerts',
   'Alertes citoyens',
   'Notifications push et SMS',
   'Diffusez rapidement des alertes (météo, sécurité, travaux) à vos administrés via push, SMS et email.',
   'bell',
   'communication',
   4),
  ('urbanism',
   'Concertations urbanisme',
   'Recueillez les avis sur les projets urbains',
   'Présentez vos projets d''aménagement avec cartes, photos et plans, et collectez les contributions citoyennes.',
   'building-2',
   'consultation',
   5);

-- ═══════ 2. COMMUNE_MODULES (modules activés par commune) ═══════
create table public.commune_modules (
  commune_id uuid not null references public.communes(id) on delete cascade,
  module_id text not null references public.modules(id),
  activated_at timestamptz default now(),
  activated_by uuid references public.profiles(id),
  settings jsonb default '{}',
  primary key (commune_id, module_id)
);

create index idx_commune_modules on public.commune_modules(commune_id);

-- Activer 'surveys' par défaut pour toutes les communes existantes
insert into public.commune_modules (commune_id, module_id)
select id, 'surveys' from public.communes
on conflict do nothing;

-- ═══════ 3. INVITATIONS (multi-admin par commune) ═══════
create table public.commune_invitations (
  id uuid primary key default gen_random_uuid(),
  commune_id uuid not null references public.communes(id) on delete cascade,
  email text not null,
  role text default 'editor' check (role in ('admin', 'editor', 'viewer')),
  invited_by uuid references public.profiles(id),
  token text unique not null default encode(gen_random_bytes(24), 'hex'),
  message text,
  accepted_at timestamptz,
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);

create index idx_invitations_email on public.commune_invitations(email);
create index idx_invitations_token on public.commune_invitations(token);
create index idx_invitations_commune on public.commune_invitations(commune_id);

-- ═══════ 4. RLS sur les nouvelles tables ═══════
alter table public.modules enable row level security;
alter table public.commune_modules enable row level security;
alter table public.commune_invitations enable row level security;

-- Modules : lecture publique
create policy "Modules are viewable by everyone"
  on public.modules for select using (is_available = true);

-- Modules super-admin : tout
create policy "Super admins manage modules"
  on public.modules for all using (public.my_role() = 'super_admin');

-- Commune_modules : lecture par membres de la commune
create policy "Commune members see their modules"
  on public.commune_modules for select
  using (commune_id = public.my_commune_id());

-- Commune_modules : super_admin et admin commune peuvent modifier
create policy "Admins manage commune modules"
  on public.commune_modules for all
  using (
    public.my_role() = 'super_admin'
    or (commune_id = public.my_commune_id() and public.my_role() = 'admin')
  );

-- Invitations : visible par la commune
create policy "Commune admins see their invitations"
  on public.commune_invitations for select
  using (
    commune_id = public.my_commune_id()
    and public.my_role() in ('admin', 'super_admin')
  );

-- Invitations : insert par admin commune
create policy "Commune admins can invite"
  on public.commune_invitations for insert
  with check (
    commune_id = public.my_commune_id()
    and public.my_role() in ('admin', 'super_admin')
  );

-- Invitations : delete par admin commune
create policy "Commune admins can revoke invitations"
  on public.commune_invitations for delete
  using (
    commune_id = public.my_commune_id()
    and public.my_role() in ('admin', 'super_admin')
  );

-- ═══════ 5. FONCTION : modules activés pour la commune courante ═══════
create or replace function public.my_active_modules()
returns setof text
language sql
security definer
stable
set search_path = public
as $$
  select cm.module_id
  from public.commune_modules cm
  where cm.commune_id = public.my_commune_id()
$$;

-- ═══════ 6. FONCTION : promouvoir un user en super_admin (manuel) ═══════
-- À appeler dans le SQL Editor : select public.make_super_admin('email@example.com');
create or replace function public.make_super_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is null then
    raise exception 'User % not found', p_email;
  end if;

  -- Crée le profil s'il n'existe pas, sinon update le rôle
  insert into public.profiles (id, role) values (v_user_id, 'super_admin')
  on conflict (id) do update set role = 'super_admin';
end;
$$;

-- ═══════ 7. VUE : commune avec stats (pour super-admin) ═══════
create or replace view public.commune_stats as
select
  c.id,
  c.name,
  c.slug,
  c.code_postal,
  c.created_at,
  (select count(*) from public.profiles where commune_id = c.id) as user_count,
  (select count(*) from public.surveys where commune_id = c.id) as survey_count,
  (select count(*) from public.responses where commune_id = c.id) as response_count,
  (select count(*) from public.commune_modules where commune_id = c.id) as module_count
from public.communes c;
