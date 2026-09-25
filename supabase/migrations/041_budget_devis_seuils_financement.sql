-- ═══════════════════════════════════════════════════════════════
-- 041 — Projets lot C : budget, devis, seuils de commande publique,
--        plan de financement, verrou du commencement d'exécution
--
-- ⚠ À appliquer AU MOMENT du déploiement du code du lot C (contraintes
--   sur les devis et le budget que l'ancien code ne respecte pas).
--
-- 1. seuils_commande_publique : table GLOBALE versionnée par date
--    d'effet (jamais une valeur unique en dur) + seuil_applicable().
--    Seed du brief §2.7 — À REVÉRIFIER avant mise en production.
-- 2. Budget : base de saisie HT (investissement) ou TTC (événement),
--    taux de TVA, 3 états prévisionnel → engagé → mandaté, section,
--    chapitre/article M57, opération ; montants HT/TTC calculés.
-- 3. Devis : montant HT obligatoire et primaire, TTC dérivé, entreprise
--    (→ contacts), lot, date de réception, validité ; un seul retenu par lot.
-- 4. Plan de financement : emprunt, parts de la commune, autofinancement
--    assumé (tracé) ; date et catégorie de la consultation ;
--    project_financement() calcule le plan et les deux contrôles
--    (part communale ≥ 20 %, aides publiques ≤ 80 %) côté serveur.
-- 5. Verrou : l'étape « Démarrage des travaux » ne peut pas passer en
--    cours / terminé sans accusé de réception d'une demande de
--    subvention ou autofinancement assumé (trigger, non contournable).
--
-- Idempotente. Retour arrière : supabase/rollback/041_budget_devis_seuils_financement_down.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Seuils de commande publique ───
create table if not exists public.seuils_commande_publique (
  id          uuid primary key default gen_random_uuid(),
  categorie   text not null check (categorie in ('travaux', 'fournitures_services')),
  type        text not null check (type in ('dispense', 'seuil_europeen')),
  montant_ht  numeric(14,2) not null check (montant_ht > 0),
  date_effet  date not null,
  date_fin    date,
  reference   text,
  commentaire text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null,
  check (date_fin is null or date_fin >= date_effet),
  unique (categorie, type, date_effet)
);
comment on table public.seuils_commande_publique is
  'Seuils nationaux de commande publique, versionnés par date d''effet. Le seuil appliqué est celui en vigueur à la date d''engagement de la consultation. Modifiable par le super-admin uniquement.';

drop trigger if exists trg_seuils_updated_at on public.seuils_commande_publique;
create trigger trg_seuils_updated_at before update on public.seuils_commande_publique
  for each row execute function public.tg_set_updated_at();

alter table public.seuils_commande_publique enable row level security;
drop policy if exists "seuils_select" on public.seuils_commande_publique;
create policy "seuils_select" on public.seuils_commande_publique for select using (auth.role() = 'authenticated');
drop policy if exists "seuils_write" on public.seuils_commande_publique;
create policy "seuils_write" on public.seuils_commande_publique for all
  using (public.my_role() = 'super_admin') with check (public.my_role() = 'super_admin');

insert into public.seuils_commande_publique (categorie, type, montant_ht, date_effet, date_fin, reference) values
  ('travaux',              'dispense',        40000,   '2020-01-01', '2025-12-31', null),
  ('travaux',              'dispense',        100000,  '2026-01-01', '2026-12-31', 'Décret n° 2025-1386 du 29 décembre 2025 (pérennisation)'),
  ('travaux',              'dispense',        140000,  '2027-01-01', null,         'Loi n° 2026-403 du 26 mai 2026, art. 13'),
  ('fournitures_services', 'dispense',        40000,   '2020-01-01', '2026-03-31', null),
  ('fournitures_services', 'dispense',        60000,   '2026-04-01', null,         'Décret n° 2025-1386 du 29 décembre 2025'),
  ('travaux',              'seuil_europeen',  5404000, '2026-01-01', '2027-12-31', 'Seuils européens 2026-2027'),
  ('fournitures_services', 'seuil_europeen',  216000,  '2026-01-01', '2027-12-31', 'Seuils européens 2026-2027 (collectivités territoriales)')
on conflict (categorie, type, date_effet) do nothing;

create or replace function public.seuil_applicable(p_categorie text, p_type text, p_date date)
returns numeric
language sql
stable
set search_path = public
as $$
  select montant_ht from public.seuils_commande_publique
   where categorie = p_categorie and type = p_type
     and date_effet <= p_date and (date_fin is null or date_fin >= p_date)
   order by date_effet desc
   limit 1;
$$;

-- ─── 2. Budget ───
alter table public.project_budget_lines
  add column if not exists base          text,
  add column if not exists taux_tva      numeric(5,2) not null default 20,
  add column if not exists etat          text not null default 'previsionnel',
  add column if not exists section       text,
  add column if not exists chapitre_m57  text,
  add column if not exists operation     text,
  add column if not exists created_by    uuid references public.profiles(id) on delete set null;

-- Base de saisie : HT pour un investissement, TTC pour un événement (fonctionnement).
update public.project_budget_lines b
   set base = case when p.type_code = 'investissement' then 'ht' else 'ttc' end,
       section = case when p.type_code = 'investissement' then 'investissement' else 'fonctionnement' end
  from public.projects p
 where p.id = b.project_id and b.base is null;
alter table public.project_budget_lines alter column base set default 'ht';
alter table public.project_budget_lines alter column base set not null;
alter table public.project_budget_lines alter column section set default 'investissement';
update public.project_budget_lines set section = 'investissement' where section is null;
alter table public.project_budget_lines alter column section set not null;

do $$ begin
  alter table public.project_budget_lines add constraint budget_base_check check (base in ('ht', 'ttc'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.project_budget_lines add constraint budget_etat_check check (etat in ('previsionnel', 'engage', 'mandate'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.project_budget_lines add constraint budget_section_check check (section in ('investissement', 'fonctionnement'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.project_budget_lines add constraint budget_tva_check check (taux_tva between 0 and 100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.project_budget_lines add constraint budget_montants_check
    check ((montant_prevu is null or montant_prevu >= 0) and (montant_reel is null or montant_reel >= 0));
exception when duplicate_object then null; end $$;

-- Catégorie « participation des associations » (recette d'un événement).
alter table public.project_budget_lines drop constraint if exists project_budget_lines_categorie_check;
alter table public.project_budget_lines add constraint project_budget_lines_categorie_check
  check (categorie is null or categorie in ('buvette', 'billetterie', 'mecenat', 'subvention', 'participation',
                                            'prestataire', 'materiel', 'location', 'personnel', 'communication',
                                            'travaux', 'etudes', 'acquisition', 'autre'));

-- Montants HT / TTC calculés depuis la base de saisie.
alter table public.project_budget_lines
  add column if not exists montant_prevu_ht numeric(14,2) generated always as (
    case when base = 'ht' then montant_prevu else round(montant_prevu / (1 + taux_tva / 100), 2) end) stored,
  add column if not exists montant_prevu_ttc numeric(14,2) generated always as (
    case when base = 'ttc' then montant_prevu else round(montant_prevu * (1 + taux_tva / 100), 2) end) stored,
  add column if not exists montant_reel_ht numeric(14,2) generated always as (
    case when base = 'ht' then montant_reel else round(montant_reel / (1 + taux_tva / 100), 2) end) stored,
  add column if not exists montant_reel_ttc numeric(14,2) generated always as (
    case when base = 'ttc' then montant_reel else round(montant_reel * (1 + taux_tva / 100), 2) end) stored;

comment on column public.project_budget_lines.montant_prevu is 'Montant prévu, dans la base de saisie (base = ht ou ttc).';
comment on column public.project_budget_lines.montant_reel is 'Montant engagé ou mandaté, dans la base de saisie.';

-- ─── 3. Devis ───
alter table public.project_quotes
  add column if not exists taux_tva        numeric(5,2) not null default 20,
  add column if not exists contact_id      uuid references public.contacts(id) on delete restrict,
  add column if not exists lot             text,
  add column if not exists date_reception  date,
  add column if not exists validite        date,
  add column if not exists created_by      uuid references public.profiles(id) on delete set null;
alter table public.project_quotes alter column phase drop not null;

do $$ begin
  alter table public.project_quotes add constraint quotes_ht_required
    check (montant_ht is not null and montant_ht >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.project_quotes add constraint quotes_tva_check check (taux_tva between 0 and 100);
exception when duplicate_object then null; end $$;

-- TTC toujours dérivé du HT (le client ne l'impose jamais).
create or replace function public.quotes_compute_ttc()
returns trigger language plpgsql set search_path = public as $$
begin
  new.montant_ttc := round(new.montant_ht * (1 + new.taux_tva / 100), 2);
  return new;
end $$;
drop trigger if exists trg_quotes_ttc on public.project_quotes;
create trigger trg_quotes_ttc before insert or update of montant_ht, taux_tva, montant_ttc on public.project_quotes
  for each row execute function public.quotes_compute_ttc();

-- Un seul devis retenu par lot.
create unique index if not exists uq_quotes_retenu_par_lot
  on public.project_quotes (project_id, coalesce(lot, ''))
  where statut = 'retenu' and deleted_at is null;
create index if not exists idx_quotes_contact on public.project_quotes (contact_id) where contact_id is not null;

-- ─── 4. Plan de financement ───
alter table public.projects
  add column if not exists emprunt_prevu              numeric(14,2),
  add column if not exists autofinancement_invest     numeric(14,2),
  add column if not exists autofinancement_fonct      numeric(14,2),
  add column if not exists autofinancement_assume     boolean not null default false,
  add column if not exists autofinancement_assume_par uuid references public.profiles(id) on delete set null,
  add column if not exists autofinancement_assume_le  timestamptz,
  add column if not exists date_consultation          date,
  add column if not exists categorie_achat            text not null default 'travaux';

do $$ begin
  alter table public.projects add constraint projects_categorie_achat_check
    check (categorie_achat in ('travaux', 'fournitures_services'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.projects add constraint projects_financement_positif_check
    check ((emprunt_prevu is null or emprunt_prevu >= 0)
       and (autofinancement_invest is null or autofinancement_invest >= 0)
       and (autofinancement_fonct is null or autofinancement_fonct >= 0));
exception when duplicate_object then null; end $$;

comment on column public.projects.autofinancement_assume is
  'La commune renonce volontairement à toute aide : lève le verrou du commencement d''exécution. Auteur et date tracés.';

-- Reprise : « sans subvention » (ancien modèle) → autofinancement assumé.
alter table public.projects disable trigger trg_projects_date_maj;
update public.projects
   set autofinancement_assume = true,
       autofinancement_assume_par = created_by,
       autofinancement_assume_le = date_maj
 where sans_subvention and not autofinancement_assume;
alter table public.projects enable trigger trg_projects_date_maj;

alter table public.financings
  add column if not exists assiette_ht numeric(14,2),
  add column if not exists contact_id  uuid references public.contacts(id) on delete restrict;

-- Plan de financement (brief §2.8), calculé sur le HT. Les aides retenues
-- sont les montants accordés (accordée / soldée) ou, à défaut de décision,
-- les montants demandés (dossier déposé / en cours d'étude).
create or replace function public.project_financement(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_taux_fctva numeric;
  v_cout_ht    numeric;
  v_cout_ttc   numeric;
  v_engage_ht  numeric;
  v_sollicite  numeric;
  v_accorde    numeric;
  v_aides      numeric;
  v_emprunt    numeric;
  v_af_inv     numeric;
  v_af_fonct   numeric;
  v_fctva      numeric;
  v_part       numeric;
  v_type       text;
begin
  select p.type_code, coalesce(p.emprunt_prevu, 0), coalesce(p.autofinancement_invest, 0),
         coalesce(p.autofinancement_fonct, 0), coalesce(cs.taux_fctva, 16.404)
    into v_type, v_emprunt, v_af_inv, v_af_fonct, v_taux_fctva
    from public.projects p
    left join public.commune_settings cs on cs.commune_id = p.commune_id
   where p.id = p_project_id;
  if v_type is null then return null; end if;

  select coalesce(sum(coalesce(case when etat = 'previsionnel' then montant_prevu_ht else coalesce(montant_reel_ht, montant_prevu_ht) end, 0)), 0),
         coalesce(sum(coalesce(case when etat = 'previsionnel' then montant_prevu_ttc else coalesce(montant_reel_ttc, montant_prevu_ttc) end, 0)), 0),
         coalesce(sum(case when etat in ('engage', 'mandate') then coalesce(montant_reel_ht, montant_prevu_ht, 0) else 0 end), 0)
    into v_cout_ht, v_cout_ttc, v_engage_ht
    from public.project_budget_lines
   where project_id = p_project_id and deleted_at is null and sens = 'depense';

  select coalesce(sum(case when statut in ('demandee', 'ar_recu', 'accordee', 'soldee') then coalesce(montant_demande, 0) else 0 end), 0),
         coalesce(sum(case when statut in ('accordee', 'soldee') then coalesce(montant_obtenu, montant_demande, 0) else 0 end), 0),
         coalesce(sum(case when statut in ('accordee', 'soldee') then coalesce(montant_obtenu, montant_demande, 0)
                           when statut in ('demandee', 'ar_recu') then coalesce(montant_demande, 0) else 0 end), 0)
    into v_sollicite, v_accorde, v_aides
    from public.financings
   where project_id = p_project_id and deleted_at is null;

  v_fctva := case when v_type = 'investissement' then round(v_cout_ttc * v_taux_fctva / 100, 2) else 0 end;
  v_part := v_cout_ht - v_aides;

  return jsonb_build_object(
    'cout_total_ht', v_cout_ht,
    'cout_total_ttc', v_cout_ttc,
    'engage_ht', v_engage_ht,
    'subventions_sollicitees', v_sollicite,
    'subventions_accordees', v_accorde,
    'aides_retenues', v_aides,
    'emprunt', v_emprunt,
    'fctva', v_fctva,
    'taux_fctva', v_taux_fctva,
    'autofinancement_invest', v_af_inv,
    'autofinancement_fonct', v_af_fonct,
    'reste_a_financer', round(v_cout_ttc - v_aides - v_fctva - v_emprunt - v_af_inv - v_af_fonct, 2),
    'part_commune_ht', v_part,
    'part_commune_pct', case when v_cout_ht > 0 then round(100 * v_part / v_cout_ht, 2) end,
    'aides_pct', case when v_cout_ht > 0 then round(100 * v_aides / v_cout_ht, 2) end,
    'controle_part_commune_ok', case when v_cout_ht > 0 then v_part >= 0.2 * v_cout_ht end,
    'part_commune_manquante', case when v_cout_ht > 0 then greatest(0, round(0.2 * v_cout_ht - v_part, 2)) end,
    'controle_aides_ok', case when v_cout_ht > 0 then v_aides <= 0.8 * v_cout_ht end,
    'aides_depassement', case when v_cout_ht > 0 then greatest(0, round(v_aides - 0.8 * v_cout_ht, 2)) end
  );
end
$$;
revoke execute on function public.project_financement(uuid) from public, anon, authenticated;
grant execute on function public.project_financement(uuid) to service_role;

-- ─── 5. Verrou du commencement d'exécution ───
alter table public.milestones add column if not exists verrou text;
do $$ begin
  alter table public.milestones add constraint milestones_verrou_check
    check (verrou is null or verrou in ('accuse_reception', 'commencement_execution'));
exception when duplicate_object then null; end $$;

-- Reprise : étapes existantes portant ces libellés dans un investissement.
update public.milestones m
   set verrou = case when m.libelle ilike 'démarrage des travaux%' then 'commencement_execution'
                     else 'accuse_reception' end
  from public.projects p
 where p.id = m.project_id and p.type_code = 'investissement' and m.verrou is null
   and (m.libelle ilike 'démarrage des travaux%' or m.libelle ilike 'accusé de réception des demandes%');

-- Nommé « zz » : s'exécute APRÈS trg_milestones_sync_legacy (ordre
-- alphabétique des triggers BEFORE), qui convertit `fait` en `statut`.
create or replace function public.milestones_check_commencement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verrou = 'commencement_execution'
     and new.statut in ('en_cours', 'termine')
     and new.deleted_at is null
     and (tg_op = 'INSERT' or old.statut = 'a_faire' or old.verrou is distinct from new.verrou)
  then
    if not exists (
         select 1 from public.financings f
          where f.project_id = new.project_id and f.deleted_at is null
            and f.date_ar is not null and f.statut <> 'refusee')
       and not exists (
         select 1 from public.projects p where p.id = new.project_id and p.autofinancement_assume)
    then
      raise exception 'COMMENCEMENT_SANS_ACCUSE_RECEPTION'
        using hint = 'Enregistrez la date d''accusé de réception d''une demande de subvention, ou cochez « projet autofinancé ».';
    end if;
  end if;
  return new;
end
$$;
revoke execute on function public.milestones_check_commencement() from public, anon, authenticated;

drop trigger if exists trg_milestones_zz_commencement on public.milestones;
create trigger trg_milestones_zz_commencement before insert or update on public.milestones
  for each row execute function public.milestones_check_commencement();

-- Les étapes créées par l'assistant portent le verrou de leur modèle.
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
  v_verrou    text;
begin
  select legacy_type into v_legacy from public.types_projet where code = v_type_code and actif;
  if v_legacy is null then raise exception 'Type de projet inconnu : %', v_type_code; end if;
  v_phase := (public.project_phase_order(v_legacy))[1];

  if btrim(coalesce(p->>'titre', '')) = '' then raise exception 'Le titre est obligatoire'; end if;

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

  for v_ref in select (jsonb_array_elements_text(coalesce(p->'partenaires', '[]'::jsonb)))::uuid loop
    if exists (select 1 from public.contacts where id = v_ref and commune_id = v_commune and deleted_at is null) then
      insert into public.project_stakeholders (project_id, stakeholder_id, role, phase)
      values (v_id, v_ref, 'execute', null)
      on conflict do nothing;
    end if;
  end loop;

  for v_jalon in select * from jsonb_array_elements(coalesce(p->'jalons', '[]'::jsonb)) loop
    v_ordre := v_ordre + 10;
    v_verrou := nullif(v_jalon->>'verrou', '');
    if v_verrou not in ('accuse_reception', 'commencement_execution') then v_verrou := null; end if;
    insert into public.milestones (project_id, libelle, statut, date_previsionnelle, est_un_jalon,
                                   remonter_au_reporting, ordre, created_by, verrou)
    values (v_id, btrim(v_jalon->>'libelle'), 'a_faire',
            nullif(v_jalon->>'date_previsionnelle', '')::timestamptz,
            coalesce((v_jalon->>'est_un_jalon')::boolean, true), true, v_ordre, v_user, v_verrou);
  end loop;

  if v_ticket is not null then
    update public.tickets set project_id = v_id where id = v_ticket and project_id is null;
  end if;

  return v_id;
end
$$;
revoke execute on function public.create_project_from_wizard(jsonb) from public, anon, authenticated;
grant execute on function public.create_project_from_wizard(jsonb) to service_role;
