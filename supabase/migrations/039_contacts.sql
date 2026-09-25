-- ═══════════════════════════════════════════════════════════════
-- 039 — Projets lot A : annuaire de contacts unique
--
-- ⚠ À appliquer AU MOMENT du déploiement du code du lot A (renomme stakeholders).
--
-- Remplace les annuaires parallèles (audit §1.2) :
--   • stakeholders (parties prenantes)       → contacts (même id conservé)
--   • commission_members.external_*          → contacts + commission_members.contact_id
--   • projects.tiers_*                       → 0 ligne en production, colonnes laissées en legacy
--   • tickets.demandeur_*                    → rattachement au lot G (passerelle tickets)
--
-- RGPD
--   Base légale : mission d'intérêt public (art. 6.1.e RGPD) — gestion des
--   projets et instances de la commune.
--   Conservation : tant que le contact est lié à un projet ou une commission
--   actifs, puis 5 ans après la clôture/archivage du dernier projet lié
--   (durée d'utilité administrative à confirmer avec les Archives
--   départementales). Au-delà : anonymisation via anonymize_contact().
--   Droit d'accès : export JSON (GET /api/contacts/:id/export).
--   Droit à l'effacement : anonymize_contact() — l'historique projet est
--   conservé, l'identité est effacée.
--
-- Idempotente. Retour arrière : supabase/rollback/039_contacts_down.sql
-- ═══════════════════════════════════════════════════════════════

do $$ begin
  create type public.contact_type as enum ('personne', 'entreprise', 'collectivite', 'financeur', 'association');
exception when duplicate_object then null; end $$;

create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  commune_id      uuid not null references public.communes(id) on delete restrict,
  type            public.contact_type not null default 'personne',
  -- Catégorie de partie prenante (ancien stakeholders.type) : interne,
  -- institutionnelle, financeur, technique, citoyenne.
  categorie       public.stakeholder_type,
  nom             text not null check (btrim(nom) <> ''),
  prenom          text,
  organisation    text,
  fonction        text,
  email           text,
  telephone       text,
  adresse         text,
  notes           text,
  source          text not null default 'saisie'
                  check (source in ('saisie', 'stakeholder', 'commission_member', 'project_tiers', 'ticket')),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles(id) on delete set null,
  anonymized_at   timestamptz
);

comment on table public.contacts is
  'Annuaire unique GoCiviq (parties prenantes, financeurs, entreprises, associations, membres externes). '
  'RGPD : base légale art. 6.1.e ; conservation 5 ans après clôture du dernier projet lié ; '
  'effacement = anonymize_contact().';

create index if not exists idx_contacts_commune on public.contacts (commune_id, nom) where deleted_at is null;
create index if not exists idx_contacts_email   on public.contacts (commune_id, lower(email)) where email is not null;

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at before update on public.contacts
  for each row execute function public.tg_set_updated_at();

alter table public.contacts enable row level security;

drop policy if exists "contacts_select" on public.contacts;
create policy "contacts_select" on public.contacts for select
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin'));

drop policy if exists "contacts_cud" on public.contacts;
create policy "contacts_cud" on public.contacts for all
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin'))
  with check (public.user_can_access_commune(commune_id)
              and public.my_role() in ('admin', 'editor', 'super_admin'));

-- ─── Reprise des parties prenantes (id conservé → FK inchangées) ───
insert into public.contacts (id, commune_id, type, categorie, nom, organisation, email, telephone, source, created_at)
select s.id, s.commune_id,
       case s.type
         when 'financeur'        then 'financeur'::public.contact_type
         when 'institutionnelle' then 'collectivite'::public.contact_type
         when 'technique'        then 'entreprise'::public.contact_type
         else 'personne'::public.contact_type
       end,
       s.type, s.nom, s.organisation, s.email, s.telephone, 'stakeholder', s.created_at
  from public.stakeholders s
on conflict (id) do nothing;

-- project_stakeholders pointe désormais sur contacts (colonne conservée).
alter table public.project_stakeholders drop constraint if exists project_stakeholders_stakeholder_id_fkey;
alter table public.project_stakeholders
  add constraint project_stakeholders_stakeholder_id_fkey
  foreign key (stakeholder_id) references public.contacts(id) on delete restrict;
create index if not exists idx_proj_stakeholders_contact on public.project_stakeholders (stakeholder_id);

-- L'ancienne table est conservée (rollback), plus lue par l'application.
do $$ begin
  if to_regclass('public.stakeholders') is not null and to_regclass('public.stakeholders_legacy') is null then
    alter table public.stakeholders rename to stakeholders_legacy;
  end if;
end $$;
comment on table public.stakeholders_legacy is 'Remplacée par contacts (migration 039). Lecture seule, conservée pour rollback.';

-- Vue de compatibilité TEMPORAIRE : le code déployé avant cette migration
-- lit encore « stakeholders ». security_invoker → RLS de contacts appliquée.
-- À supprimer une fois le lot A déployé (lot B).
create or replace view public.stakeholders with (security_invoker = true) as
  select id, commune_id, nom, organisation, email, telephone, categorie as type, created_at
    from public.contacts
   where deleted_at is null;

-- ─── Membres externes de commission → contacts ───
alter table public.commission_members
  add column if not exists contact_id uuid references public.contacts(id) on delete restrict;
create index if not exists idx_commission_members_contact on public.commission_members (contact_id);

-- Un contact par personne externe et par commune : dédoublonnage sur
-- l'email (insensible à la casse), sinon sur le nom normalisé. Réutilise
-- un contact existant (ex. partie prenante) de même email.
with ext as (
  select m.id as member_id, c.commune_id,
         btrim(m.external_name) as nom,
         nullif(lower(btrim(m.external_email)), '') as email_n,
         nullif(btrim(m.external_email), '') as email,
         nullif(btrim(m.external_phone), '') as tel,
         coalesce(nullif(lower(btrim(m.external_email)), ''), 'nom:' || lower(btrim(m.external_name))) as cle
    from public.commission_members m
    join public.commissions c on c.id = m.commission_id
   where m.user_id is null and m.contact_id is null and btrim(coalesce(m.external_name, '')) <> ''
),
uniq as (
  select distinct on (commune_id, cle) commune_id, cle, nom, email, tel, email_n
    from ext order by commune_id, cle, nom
),
existing as (
  select u.commune_id, u.cle, ct.id as contact_id
    from uniq u
    join public.contacts ct on ct.commune_id = u.commune_id and u.email_n is not null
                          and lower(ct.email) = u.email_n and ct.deleted_at is null
),
created as (
  insert into public.contacts (commune_id, type, nom, email, telephone, source)
  select u.commune_id, 'personne', u.nom, u.email, u.tel, 'commission_member'
    from uniq u
   where not exists (select 1 from existing e where e.commune_id = u.commune_id and e.cle = u.cle)
  returning id, commune_id,
            coalesce(nullif(lower(email), ''), 'nom:' || lower(nom)) as cle
),
resolved as (
  select commune_id, cle, contact_id from existing
  union all
  select commune_id, cle, id from created
)
update public.commission_members m
   set contact_id = r.contact_id
  from ext e
  join resolved r on r.commune_id = e.commune_id and r.cle = e.cle
 where m.id = e.member_id;

-- Les colonnes external_* restent renseignées (double écriture pendant la
-- transition : convocations et émargement les lisent encore).
alter table public.commission_members drop constraint if exists commission_members_identity_check;
alter table public.commission_members add constraint commission_members_identity_check
  check (user_id is not null or contact_id is not null or btrim(coalesce(external_name, '')) <> '');

-- ─── Parties prenantes d'étape ───
create table if not exists public.milestone_contacts (
  id           uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones(id) on delete restrict,
  contact_id   uuid not null references public.contacts(id) on delete restrict,
  created_at   timestamptz not null default now(),
  unique (milestone_id, contact_id)
);
create index if not exists idx_milestone_contacts_contact on public.milestone_contacts (contact_id);

alter table public.milestone_contacts enable row level security;
drop policy if exists "milestone_contacts_select" on public.milestone_contacts;
create policy "milestone_contacts_select" on public.milestone_contacts for select
  using (exists (
    select 1 from public.milestones m join public.projects p on p.id = m.project_id
     where m.id = milestone_contacts.milestone_id
       and public.user_can_access_commune(p.commune_id)
       and public.my_role() in ('admin', 'editor', 'super_admin')));
drop policy if exists "milestone_contacts_cud" on public.milestone_contacts;
create policy "milestone_contacts_cud" on public.milestone_contacts for all
  using (exists (select 1 from public.milestones m
                  where m.id = milestone_contacts.milestone_id and public.user_can_edit_project(m.project_id)))
  with check (exists (select 1 from public.milestones m
                  where m.id = milestone_contacts.milestone_id and public.user_can_edit_project(m.project_id)));

-- ─── RGPD : anonymisation (droit à l'effacement) ───
create or replace function public.anonymize_contact(p_contact_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commune uuid;
begin
  select commune_id into v_commune from public.contacts where id = p_contact_id;
  if v_commune is null then return false; end if;
  -- Appel direct (JWT) : admin/super_admin de la commune ; service role : autorisé.
  if auth.uid() is not null and not (
       public.user_can_access_commune(v_commune) and public.my_role() in ('admin', 'super_admin')
     ) then
    raise exception 'Permissions insuffisantes';
  end if;

  update public.contacts
     set nom = 'Contact anonymisé', prenom = null, organisation = null, fonction = null,
         email = null, telephone = null, adresse = null, notes = null,
         anonymized_at = now()
   where id = p_contact_id;

  update public.commission_members
     set external_name = 'Contact anonymisé', external_email = null, external_phone = null
   where contact_id = p_contact_id;
  return true;
end
$$;
revoke execute on function public.anonymize_contact(uuid) from public, anon;
grant execute on function public.anonymize_contact(uuid) to authenticated, service_role;
