-- Retour arrière de 039 — rétablit stakeholders comme annuaire des parties prenantes.
-- ⚠ Les contacts créés après 037 (hors reprise stakeholders) doivent être
--   ré-insérés dans stakeholders avant de supprimer contacts : c'est fait ci-dessous
--   pour ceux qui sont référencés par project_stakeholders.

drop view if exists public.stakeholders;
drop table if exists public.milestone_contacts;

do $$ begin
  if to_regclass('public.stakeholders_legacy') is not null and to_regclass('public.stakeholders') is null then
    alter table public.stakeholders_legacy rename to stakeholders;
  end if;
end $$;

insert into public.stakeholders (id, commune_id, nom, organisation, email, telephone, type, created_at)
select c.id, c.commune_id, c.nom, c.organisation, c.email, c.telephone,
       coalesce(c.categorie, 'institutionnelle'), c.created_at
  from public.contacts c
 where exists (select 1 from public.project_stakeholders ps where ps.stakeholder_id = c.id)
on conflict (id) do nothing;

alter table public.project_stakeholders drop constraint if exists project_stakeholders_stakeholder_id_fkey;
alter table public.project_stakeholders
  add constraint project_stakeholders_stakeholder_id_fkey
  foreign key (stakeholder_id) references public.stakeholders(id) on delete restrict;
drop index if exists public.idx_proj_stakeholders_contact;

alter table public.commission_members drop constraint if exists commission_members_identity_check;
alter table public.commission_members add constraint commission_members_identity_check
  check (user_id is not null or btrim(coalesce(external_name, '')) <> '');
alter table public.commission_members drop column if exists contact_id;

drop function if exists public.anonymize_contact(uuid);
drop table if exists public.contacts;
drop type if exists public.contact_type;
