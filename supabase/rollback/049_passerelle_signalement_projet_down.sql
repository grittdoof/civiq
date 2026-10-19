-- Retour arrière de 049_passerelle_signalement_projet.sql
-- Les signalements convertis repassent en « clos » (lien projet conservé),
-- la RPC et la vue reprennent leur définition de 041 / 013 (vue gardée privée).
update public.tickets set statut = 'clos' where statut = 'converti_en_projet';

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


create or replace view public.tickets_reporting_v
with (security_invoker = true) as
  select
    t.commune_id, t.id, t.numero, t.titre, t.categorie, t.priorite, t.statut, t.canal,
    t.assigne_a, t.created_by, t.created_at, t.assigne_at, t.pris_en_charge_at,
    t.resolu_at, t.clos_at, t.echeance,
    case
      when t.resolu_at is not null
      then extract(epoch from (t.resolu_at - t.created_at)) / 3600
      else null
    end as delai_resolution_h,
    case
      when t.echeance is not null
        and t.echeance < current_date
        and t.statut not in ('clos', 'annule', 'resolu')
      then true else false
    end as en_retard,
    (
      select count(*) > 0
        from public.ticket_commentaires c
       where c.ticket_id = t.id
         and c.is_systeme = true
         and c.contenu like 'Statut : resolu → %'
    ) as a_ete_reouvert
  from public.tickets t;

revoke execute on function public.create_project_from_wizard(jsonb) from public, anon, authenticated;
grant execute on function public.create_project_from_wizard(jsonb) to service_role;

revoke all on public.tickets_reporting_v from anon, authenticated;
grant select on public.tickets_reporting_v to service_role;
