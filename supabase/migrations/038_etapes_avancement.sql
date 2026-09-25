-- ═══════════════════════════════════════════════════════════════
-- 038 — Projets lot A : étapes (milestones étendue) + avancement
--
-- 1. milestones devient la table des « étapes » communes aux 3 types
--    (brief §2.4) : statut 3 états, date prévisionnelle ET réelle (avec
--    heure), est_un_jalon, remonter_au_reporting, commentaire avec note
--    interne, ordre. `fait` et `echeance` restent synchronisés par trigger
--    le temps que l'interface actuelle soit remplacée (lot B).
--    `phase` devient facultative (les étapes ne dépendent plus des phases).
-- 2. Pièces jointes d'étape (parties prenantes d'étape : milestone_contacts, migration 039).
-- 3. Avancement (brief §2.6) : jalons terminés / jalons, NULL si aucun
--    jalon (« non renseigné », jamais 0 %) ; dénormalisé par trigger ;
--    surcharge manuelle tracée (pct + motif + auteur + date).
--
-- Idempotente. Retour arrière : supabase/rollback/038_etapes_avancement_down.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Étapes ───
alter table public.milestones
  add column if not exists statut                   text,
  add column if not exists date_previsionnelle      timestamptz,
  add column if not exists date_reelle              timestamptz,
  add column if not exists est_un_jalon             boolean not null default true,
  add column if not exists remonter_au_reporting    boolean not null default true,
  add column if not exists commentaire              text,
  add column if not exists commentaire_note_interne boolean not null default false,
  add column if not exists ordre                    integer,
  add column if not exists created_by               uuid references public.profiles(id) on delete set null;

alter table public.milestones alter column phase drop not null;

-- Reprise : fait → statut, echeance → date prévisionnelle, ordre chronologique.
-- (updated_at préservé : ce n'est pas une modification par un utilisateur)
alter table public.milestones disable trigger trg_milestones_updated_at;
update public.milestones
   set statut = case when fait then 'termine' else 'a_faire' end
 where statut is null;
update public.milestones
   set date_previsionnelle = echeance::timestamptz
 where date_previsionnelle is null and echeance is not null;
with o as (
  select id, row_number() over (partition by project_id order by echeance nulls last, created_at) * 10 as rk
    from public.milestones
)
update public.milestones m set ordre = o.rk from o where o.id = m.id and m.ordre is null;
alter table public.milestones enable trigger trg_milestones_updated_at;

alter table public.milestones alter column statut set default 'a_faire';
alter table public.milestones alter column statut set not null;
do $$ begin
  alter table public.milestones add constraint milestones_statut_check
    check (statut in ('a_faire', 'en_cours', 'termine'));
exception when duplicate_object then null; end $$;

comment on column public.milestones.est_un_jalon is 'Seuls les jalons comptent dans l''avancement opérationnel.';
comment on column public.milestones.date_reelle is 'Date effective : permet de détecter les retards et alimente le calendrier.';

create index if not exists idx_milestones_prev on public.milestones (project_id, date_previsionnelle) where deleted_at is null;

-- Synchronisation legacy : fait ↔ statut, echeance ↔ date_previsionnelle.
create or replace function public.milestones_sync_legacy()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.statut is null or (new.statut = 'a_faire' and new.fait) then
      new.statut := case when new.fait then 'termine' else 'a_faire' end;
    end if;
    new.fait := (new.statut = 'termine');
    if new.date_previsionnelle is null and new.echeance is not null then
      new.date_previsionnelle := new.echeance::timestamptz;
    elsif new.echeance is null and new.date_previsionnelle is not null then
      new.echeance := (new.date_previsionnelle at time zone 'UTC')::date;
    end if;
  else
    if new.statut is distinct from old.statut then
      new.fait := (new.statut = 'termine');
    elsif new.fait is distinct from old.fait then
      new.statut := case when new.fait then 'termine' else 'a_faire' end;
    end if;
    if new.date_previsionnelle is distinct from old.date_previsionnelle then
      new.echeance := (new.date_previsionnelle at time zone 'UTC')::date;
    elsif new.echeance is distinct from old.echeance then
      new.date_previsionnelle := new.echeance::timestamptz;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_milestones_sync_legacy on public.milestones;
create trigger trg_milestones_sync_legacy before insert or update on public.milestones
  for each row execute function public.milestones_sync_legacy();

-- ─── 2. Pièces jointes d'étape ───
alter table public.project_documents
  add column if not exists milestone_id uuid references public.milestones(id) on delete restrict,
  add column if not exists note_interne boolean not null default false;
create index if not exists idx_project_documents_milestone on public.project_documents (milestone_id) where milestone_id is not null;

-- ─── 3. Avancement ───
alter table public.projects
  add column if not exists avancement_pct          numeric(5,2),
  add column if not exists avancement_manuel_pct   numeric(5,2),
  add column if not exists avancement_manuel_motif text,
  add column if not exists avancement_manuel_par   uuid references public.profiles(id) on delete set null,
  add column if not exists avancement_manuel_le    timestamptz;

do $$ begin
  alter table public.projects add constraint projects_avancement_manuel_check
    check (avancement_manuel_pct is null
           or (avancement_manuel_pct between 0 and 100 and btrim(coalesce(avancement_manuel_motif, '')) <> ''));
exception when duplicate_object then null; end $$;

comment on column public.projects.avancement_pct is
  'Avancement opérationnel = jalons terminés / jalons (hors supprimés). NULL = non renseigné (aucun jalon). Maintenu par trigger.';

create or replace function public.project_recompute_avancement(p_project_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  with calc as (
    select case when count(*) = 0 then null
                else round(100.0 * count(*) filter (where m.statut = 'termine') / count(*), 2) end as pct
      from public.milestones m
     where m.project_id = p_project_id and m.est_un_jalon and m.deleted_at is null
  )
  update public.projects p
     set avancement_pct = calc.pct
    from calc
   where p.id = p_project_id and p.avancement_pct is distinct from calc.pct;
$$;
revoke execute on function public.project_recompute_avancement(uuid) from public, anon, authenticated;

create or replace function public.milestones_recompute_avancement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.project_recompute_avancement(old.project_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id) then
    perform public.project_recompute_avancement(new.project_id);
  end if;
  return null;
end
$$;
revoke execute on function public.milestones_recompute_avancement() from public, anon, authenticated;

drop trigger if exists trg_milestones_avancement on public.milestones;
create trigger trg_milestones_avancement
  after insert or delete or update of statut, fait, est_un_jalon, deleted_at, project_id on public.milestones
  for each row execute function public.milestones_recompute_avancement();

-- Calcul initial (date_maj préservée : l'ordre « derniers modifiés » ne bouge pas)
alter table public.projects disable trigger trg_projects_date_maj;
do $$
declare r record;
begin
  for r in select id from public.projects loop
    perform public.project_recompute_avancement(r.id);
  end loop;
end $$;
alter table public.projects enable trigger trg_projects_date_maj;
