-- ═══════════════════════════════════════════════════════════════
-- 040 — Projets lot B : parcours de création par type + écran de vie
--
-- 1. Fin de la vue de compatibilité `stakeholders` (code du lot A déployé).
-- 2. Champs des parcours (brief §2.3) :
--      commission pilote (une seule) — commission_projects reste le lien
--      N-N et porte aussi les commissions associées ;
--      fourchette d'estimation, échéance souhaitée (investissement) ;
--      date/heure/lieu/jauge (événement) ;
--      blocs ajoutés à un suivi simple (« Ajouter des devis »).
-- 3. Contributeurs (profils de la commune).
-- 4. create_project_from_wizard() : création transactionnelle (projet,
--    étapes modèles, commissions, contributeurs, partenaires, lien ticket)
--    avec contrôle d'appartenance à la commune de chaque référence.
--
-- Convention de date (Session 16) : l'heure murale est stockée dans les
-- composantes UTC (saisie « 2026-11-11 10:30 » → 2026-11-11T10:30:00Z).
--
-- Idempotente. Retour arrière : supabase/rollback/040_parcours_creation_down.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Vue de compatibilité ───
drop view if exists public.stakeholders;

-- ─── 2. Champs des parcours ───
alter table public.projects
  add column if not exists commission_pilote_id  uuid references public.commissions(id) on delete restrict,
  add column if not exists fourchette_estimation text,
  add column if not exists echeance_souhaitee    date,
  add column if not exists evenement_debut       timestamptz,
  add column if not exists evenement_fin         timestamptz,
  add column if not exists lieu                  text,
  add column if not exists jauge                 integer,
  add column if not exists blocs_supplementaires text[] not null default '{}';

do $$ begin
  alter table public.projects add constraint projects_fourchette_check
    check (fourchette_estimation is null
           or fourchette_estimation in ('moins_20k', '20k_100k', '100k_500k', 'plus_500k', 'inconnu'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.projects add constraint projects_jauge_check check (jauge is null or jauge >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.projects add constraint projects_evenement_fin_check
    check (evenement_fin is null or evenement_debut is null or evenement_fin >= evenement_debut);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.projects add constraint projects_blocs_supp_check
    check (blocs_supplementaires <@ array['devis']::text[]);
exception when duplicate_object then null; end $$;

comment on column public.projects.fourchette_estimation is
  'Ordre de grandeur saisi à la création (pas un budget) : sert à annoncer les règles de commande publique.';
comment on column public.projects.pilote_elu is 'Élu référent (unique, requis à la création depuis le lot B).';

create index if not exists idx_projects_commission_pilote on public.projects (commission_pilote_id) where deleted_at is null;

-- Reprise : chaque projet rattaché à exactement une commission (27/27 à
-- Châteauneuf) la prend comme commission pilote. date_maj préservée.
alter table public.projects disable trigger trg_projects_date_maj;
update public.projects p
   set commission_pilote_id = cp.commission_id
  from (
    select project_id, min(commission_id::text)::uuid as commission_id
      from public.commission_projects
     group by project_id
    having count(*) = 1
  ) cp
 where cp.project_id = p.id and p.commission_pilote_id is null;
alter table public.projects enable trigger trg_projects_date_maj;

-- ─── 3. Contributeurs ───
create table if not exists public.project_contributors (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete restrict,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (project_id, profile_id)
);
create index if not exists idx_project_contributors_profile on public.project_contributors (profile_id);

alter table public.project_contributors enable row level security;
drop policy if exists "contributors_select" on public.project_contributors;
create policy "contributors_select" on public.project_contributors for select
  using (exists (select 1 from public.projects p
                  where p.id = project_contributors.project_id
                    and public.user_can_access_commune(p.commune_id)
                    and public.my_role() in ('admin', 'editor', 'super_admin')));
drop policy if exists "contributors_cud" on public.project_contributors;
create policy "contributors_cud" on public.project_contributors for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ─── 4. Création transactionnelle ───
create or replace function public.create_project_from_wizard(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commune   uuid := (p->>'commune_id')::uuid;
  v_user      uuid := nullif(p->>'created_by', '')::uuid;
  v_type_code text := p->>'type_code';
  v_legacy    public.project_type;
  v_phase     public.project_phase;
  v_id        uuid;
  v_pilote    uuid := nullif(p->>'commission_pilote_id', '')::uuid;
  v_elu       uuid := nullif(p->>'elu_referent_id', '')::uuid;
  v_agent     uuid := nullif(p->>'agent_pilote_id', '')::uuid;
  v_ticket    uuid := nullif(p->>'source_ticket_id', '')::uuid;
  v_ref       uuid;
  v_jalon     jsonb;
  v_ordre     int := 0;
begin
  select legacy_type into v_legacy from public.types_projet where code = v_type_code and actif;
  if v_legacy is null then raise exception 'Type de projet inconnu : %', v_type_code; end if;
  v_phase := (public.project_phase_order(v_legacy))[1];

  if btrim(coalesce(p->>'titre', '')) = '' then raise exception 'Le titre est obligatoire'; end if;

  -- Toute référence doit appartenir à la commune du projet.
  if v_pilote is not null and not exists (
       select 1 from public.commissions where id = v_pilote and commune_id = v_commune and deleted_at is null) then
    raise exception 'Commission introuvable';
  end if;
  if v_elu is not null and not exists (select 1 from public.profiles where id = v_elu and commune_id = v_commune) then
    raise exception 'Élu référent introuvable';
  end if;
  if v_agent is not null and not exists (select 1 from public.profiles where id = v_agent and commune_id = v_commune) then
    raise exception 'Agent pilote introuvable';
  end if;
  if v_ticket is not null and not exists (select 1 from public.tickets where id = v_ticket and commune_id = v_commune) then
    raise exception 'Ticket introuvable';
  end if;

  insert into public.projects (
    commune_id, titre, description, type_code, phase, pilote_elu, pilote_agent,
    commission_pilote_id, fourchette_estimation, echeance_souhaitee,
    evenement_debut, evenement_fin, lieu, jauge, source_ticket_id, created_by
  ) values (
    v_commune, btrim(p->>'titre'), nullif(btrim(coalesce(p->>'description', '')), ''), v_type_code, v_phase,
    v_elu, v_agent, v_pilote, nullif(p->>'fourchette_estimation', ''),
    nullif(p->>'echeance_souhaitee', '')::date,
    nullif(p->>'evenement_debut', '')::timestamptz, nullif(p->>'evenement_fin', '')::timestamptz,
    nullif(btrim(coalesce(p->>'lieu', '')), ''), nullif(p->>'jauge', '')::int,
    v_ticket, v_user
  ) returning id into v_id;

  -- Commissions : pilote + associées (lien N-N existant).
  if v_pilote is not null then
    insert into public.commission_projects (commission_id, project_id) values (v_pilote, v_id)
    on conflict do nothing;
  end if;
  for v_ref in select (jsonb_array_elements_text(coalesce(p->'commissions_associees', '[]'::jsonb)))::uuid loop
    if exists (select 1 from public.commissions where id = v_ref and commune_id = v_commune and deleted_at is null) then
      insert into public.commission_projects (commission_id, project_id) values (v_ref, v_id)
      on conflict do nothing;
    end if;
  end loop;

  for v_ref in select (jsonb_array_elements_text(coalesce(p->'contributeurs', '[]'::jsonb)))::uuid loop
    if exists (select 1 from public.profiles where id = v_ref and commune_id = v_commune) then
      insert into public.project_contributors (project_id, profile_id) values (v_id, v_ref)
      on conflict do nothing;
    end if;
  end loop;

  -- Partenaires (contacts de la commune) : rôle « exécute ».
  for v_ref in select (jsonb_array_elements_text(coalesce(p->'partenaires', '[]'::jsonb)))::uuid loop
    if exists (select 1 from public.contacts where id = v_ref and commune_id = v_commune and deleted_at is null) then
      insert into public.project_stakeholders (project_id, stakeholder_id, role, phase)
      values (v_id, v_ref, 'execute', null)
      on conflict do nothing;
    end if;
  end loop;

  -- Étapes proposées (jalons modèles cochés par l'utilisateur).
  for v_jalon in select * from jsonb_array_elements(coalesce(p->'jalons', '[]'::jsonb)) loop
    v_ordre := v_ordre + 10;
    insert into public.milestones (project_id, libelle, statut, date_previsionnelle, est_un_jalon,
                                   remonter_au_reporting, ordre, created_by)
    values (v_id, btrim(v_jalon->>'libelle'), 'a_faire',
            nullif(v_jalon->>'date_previsionnelle', '')::timestamptz,
            coalesce((v_jalon->>'est_un_jalon')::boolean, true), true, v_ordre, v_user);
  end loop;

  if v_ticket is not null then
    update public.tickets set project_id = v_id where id = v_ticket and project_id is null;
  end if;

  return v_id;
end
$$;
revoke execute on function public.create_project_from_wizard(jsonb) from public, anon, authenticated;
grant execute on function public.create_project_from_wizard(jsonb) to service_role;
