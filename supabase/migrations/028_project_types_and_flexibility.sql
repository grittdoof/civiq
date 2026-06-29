-- ═══════════════════════════════════════════════════════════════
-- Migration 028 — Types de projet + flexibilité du parcours
-- ═══════════════════════════════════════════════════════════════
--
-- Le module projet supporte désormais 3 gabarits :
--   • investment  — investissement structurant (7 phases — gabarit historique)
--   • event       — événementiel / manifestation (5 phases)
--   • tracking    — suivi simple / démarche continue (3 phases)
--
-- Le type est choisi à la création et reste modifiable. La RPC
-- advance_project_phase est réécrite pour connaître l'ordre canonique
-- des phases du gabarit du projet.
--
-- Règle clé du brief : « les portes de sortie sont indicatives, jamais
-- bloquantes ». La porte de financement et le bilan obligatoire qui
-- étaient bloquants en 017 deviennent ici des WARNINGS non bloquants.
-- Seuls restent bloquants : auth, accès commune, rôle, recul sans
-- commentaire, saut > 1 étape sans force+admin.
--
-- Une phase entière peut être marquée « non applicable » via
-- projects.phase_not_applicable jsonb ; les transitions qui sautent
-- une telle phase ne sont alors plus considérées comme un saut.
--
-- Idempotente — rejouable sans danger.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Nouveau enum project_type ───────────────────────────────
do $$ begin
  create type public.project_type as enum (
    'investment', 'event', 'tracking'
  );
exception when duplicate_object then null; end $$;

-- ─── 2. Extension de l'enum project_phase ───────────────────────
-- Les 8 nouvelles valeurs couvrent les gabarits event (5) et tracking (3).
-- Préfixe court pour éviter les collisions avec les phases investment.
alter type public.project_phase add value if not exists 'event_framing';
alter type public.project_phase add value if not exists 'event_authorizations';
alter type public.project_phase add value if not exists 'event_logistics';
alter type public.project_phase add value if not exists 'event_dday';
alter type public.project_phase add value if not exists 'event_review';
alter type public.project_phase add value if not exists 'tracking_framing';
alter type public.project_phase add value if not exists 'tracking_execution';
alter type public.project_phase add value if not exists 'tracking_review';

-- ─── 3. Nouvelles colonnes sur projects ─────────────────────────
alter table public.projects
  add column if not exists type public.project_type not null default 'investment',
  add column if not exists phase_not_applicable jsonb not null default '{}'::jsonb;

comment on column public.projects.type is
  'Gabarit du projet : investment (7 phases) / event (5) / tracking (3).';
comment on column public.projects.phase_not_applicable is
  'Phases marquées « non applicable » pour ce projet. '
  'Format : { phase_key: motif_text }. Les phases listées sortent du '
  'calcul de progression et leur traversée n''est pas comptée comme un saut.';

create index if not exists idx_projects_type
  on public.projects(commune_id, type);

-- ─── 4. Helper : ordre canonique des phases par gabarit ─────────
-- Retourne le tableau ordonné des phases du gabarit donné. Utilisé
-- par toutes les fonctions de transition pour calculer les indices.
create or replace function public.project_phase_order(t public.project_type)
returns public.project_phase[]
language sql immutable as $$
  select case t
    when 'investment' then array[
      'emergence', 'faisabilite', 'decision_budget', 'financement',
      'conception_marches', 'realisation', 'bilan_cloture'
    ]::public.project_phase[]
    when 'event' then array[
      'event_framing', 'event_authorizations', 'event_logistics',
      'event_dday', 'event_review'
    ]::public.project_phase[]
    when 'tracking' then array[
      'tracking_framing', 'tracking_execution', 'tracking_review'
    ]::public.project_phase[]
  end
$$;

grant execute on function public.project_phase_order(public.project_type) to authenticated;

-- ─── 5. Helper : position d'une phase dans son gabarit ──────────
-- Retourne 1..N (1-indexé) ou NULL si la phase n'appartient pas au
-- gabarit demandé.
create or replace function public.project_phase_position(
  p public.project_phase,
  t public.project_type
) returns int
language sql immutable as $$
  select array_position(public.project_phase_order(t), p)::int
$$;

grant execute on function public.project_phase_position(public.project_phase, public.project_type) to authenticated;

-- ─── 6. Helper : nombre de phases NA entre deux positions ───────
-- Compte combien de phases marquées « non applicable » se trouvent
-- strictement entre from_idx et to_idx (exclus) dans le gabarit du
-- projet. Sert à calculer la « distance effective » d'une transition.
create or replace function public.project_na_phases_between(
  p_project_id uuid,
  p_from_idx int,
  p_to_idx int
) returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_type public.project_type;
  v_order public.project_phase[];
  v_na jsonb;
  v_lo int;
  v_hi int;
  v_count int := 0;
  i int;
  v_key text;
begin
  if p_from_idx is null or p_to_idx is null then
    return 0;
  end if;
  select type, phase_not_applicable into v_type, v_na
    from public.projects where id = p_project_id;
  if v_type is null then return 0; end if;
  if jsonb_typeof(v_na) is distinct from 'object' or v_na = '{}'::jsonb then
    return 0;
  end if;
  v_order := public.project_phase_order(v_type);
  v_lo := least(p_from_idx, p_to_idx);
  v_hi := greatest(p_from_idx, p_to_idx);
  for i in (v_lo + 1)..(v_hi - 1) loop
    v_key := v_order[i]::text;
    if v_na ? v_key then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

grant execute on function public.project_na_phases_between(uuid, int, int) to authenticated;

-- ─── 7. Réécriture de project_phase_index (rétrocompat) ─────────
-- L'ancienne fonction hardcodait les 7 phases d'investissement. On
-- la conserve pour ne pas casser les consommateurs externes éventuels,
-- mais elle est désormais déconseillée — utiliser project_phase_position.
create or replace function public.project_phase_index(p public.project_phase)
returns int language sql immutable as $$
  select public.project_phase_position(p, 'investment')
$$;

comment on function public.project_phase_index(public.project_phase) is
  'DÉPRÉCIÉ : ne couvre que le gabarit investment. '
  'Utiliser project_phase_position(phase, type) pour les autres gabarits.';

-- ─── 8. Réécriture de project_can_advance ───────────────────────
-- Source de vérité du décideur métier. Les anciennes règles bloquantes
-- (porte de financement, bilan obligatoire) deviennent des WARNINGS
-- conformément au brief « portes indicatives, jamais bloquantes ».
create or replace function public.project_can_advance(
  p_project_id uuid,
  p_to_phase public.project_phase
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_project public.projects%rowtype;
  v_from_idx int;
  v_to_idx int;
  v_step int;
  v_eff_step int;
  v_na_between int;
  v_has_secured boolean;
  v_warnings text[] := array[]::text[];
  v_decide_count int;
  v_financeur_count int;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Projet introuvable');
  end if;

  v_from_idx := public.project_phase_position(v_project.phase, v_project.type);
  v_to_idx   := public.project_phase_position(p_to_phase, v_project.type);

  -- Phase cible étrangère au gabarit du projet : refus net.
  if v_to_idx is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Cette phase n''appartient pas au gabarit du projet. '
                'Changez d''abord le type du projet pour utiliser cette phase.'
    );
  end if;

  if v_from_idx = v_to_idx then
    return jsonb_build_object('ok', false, 'reason', 'Le projet est déjà à cette étape');
  end if;

  v_step := v_to_idx - v_from_idx;

  -- Recul : autorisé, commentaire obligatoire (contrôlé par advance_project_phase)
  if v_step < 0 then
    return jsonb_build_object(
      'ok', true,
      'direction', 'backward',
      'require_comment', true,
      'warnings', '[]'::jsonb
    );
  end if;

  -- Calcul de la « distance effective » : on ne compte pas les phases NA.
  v_na_between := public.project_na_phases_between(p_project_id, v_from_idx, v_to_idx);
  v_eff_step := v_step - v_na_between;

  -- Saut > 1 étape effective : nécessite force (contrôle final dans
  -- advance_project_phase qui vérifie aussi le rôle + commentaire).
  if v_eff_step > 1 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Sauter une étape n''est pas autorisé. Utilisez « forcer » (admin uniquement) avec un commentaire.',
      'require_force', true,
      'warnings', '[]'::jsonb
    );
  end if;

  -- ─── Warnings métier (non bloquants) ───
  -- Les anciennes règles porte/bilan deviennent des avertissements.
  -- Spécifiques au gabarit investment uniquement.
  if v_project.type = 'investment' then
    -- Porte de financement (vers realisation)
    if p_to_phase = 'realisation' then
      select exists (
        select 1 from public.financings
        where project_id = p_project_id
          and statut in ('ar_recu', 'accordee', 'soldee')
      ) into v_has_secured;
      if not (v_has_secured or v_project.sans_subvention) then
        v_warnings := array_append(v_warnings,
          'Aucune subvention sécurisée et autofinancement non déclaré. '
          'Le risque d''irrégularité est élevé si vous notifiez un marché maintenant.');
      end if;
    end if;

    -- Bilan recommandé (vers bilan_cloture)
    if p_to_phase = 'bilan_cloture' then
      if v_project.cout_reel is null or coalesce(trim(v_project.explication_ecart), '') = '' then
        v_warnings := array_append(v_warnings,
          'Bilan incomplet : coût réel ou explication de l''écart manquants. '
          'La clôture reste possible mais le projet n''aura pas de bilan exploitable.');
      end if;
    end if;

    -- Partie prenante « décide » à l'entrée de decision_budget
    if p_to_phase = 'decision_budget' then
      select count(*) into v_decide_count
        from public.project_stakeholders
        where project_id = p_project_id and role = 'decide';
      if v_decide_count = 0 then
        v_warnings := array_append(v_warnings,
          'Aucune partie prenante avec le rôle « décide » n''est associée.');
      end if;
    end if;

    -- Partie prenante « financeur » à l'entrée de financement
    if p_to_phase = 'financement' then
      select count(*) into v_financeur_count
        from public.project_stakeholders ps
        join public.stakeholders s on s.id = ps.stakeholder_id
        where ps.project_id = p_project_id and s.type = 'financeur';
      if v_financeur_count = 0 then
        v_warnings := array_append(v_warnings,
          'Aucune partie prenante de type « financeur » n''est associée.');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'direction', 'forward',
    'warnings', to_jsonb(v_warnings)
  );
end $$;

grant execute on function public.project_can_advance(uuid, public.project_phase) to authenticated;

-- ─── 9. Réécriture de advance_project_phase ─────────────────────
-- Source d'autorité de l'écriture. Les blocages métier sont supprimés
-- (devenus warnings) ; ne reste que l'opérationnel : auth, accès, rôle,
-- recul→commentaire, saut→force+admin+commentaire.
create or replace function public.advance_project_phase(
  p_project_id uuid,
  p_to_phase public.project_phase,
  p_commentaire text,
  p_force boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_can jsonb;
  v_role text;
  v_from public.project_phase;
  v_type public.project_type;
  v_from_idx int;
  v_to_idx int;
  v_step int;
  v_na_between int;
  v_eff_step int;
  v_commune uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'Non authentifié');
  end if;

  select phase, type, commune_id into v_from, v_type, v_commune
    from public.projects where id = p_project_id;
  if v_from is null then
    return jsonb_build_object('ok', false, 'reason', 'Projet introuvable');
  end if;

  if not public.user_can_access_commune(v_commune) then
    return jsonb_build_object('ok', false, 'reason', 'Accès refusé');
  end if;

  select public.my_role() into v_role;
  if v_role not in ('admin', 'editor', 'super_admin') then
    return jsonb_build_object('ok', false, 'reason', 'Permissions insuffisantes');
  end if;

  v_from_idx := public.project_phase_position(v_from, v_type);
  v_to_idx   := public.project_phase_position(p_to_phase, v_type);

  if v_to_idx is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Cette phase n''appartient pas au gabarit du projet.'
    );
  end if;

  v_step := v_to_idx - v_from_idx;

  -- Recul : commentaire obligatoire
  if v_step < 0 and coalesce(trim(p_commentaire), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'Un commentaire est obligatoire pour reculer d''étape.');
  end if;

  -- Distance effective (saut au-dessus des phases NA toléré)
  v_na_between := public.project_na_phases_between(p_project_id, v_from_idx, v_to_idx);
  v_eff_step := v_step - v_na_between;

  -- Saut > 1 étape effective : nécessite force ET admin/super_admin ET commentaire
  if v_eff_step > 1 then
    if not p_force then
      return jsonb_build_object(
        'ok', false,
        'reason', 'Sauter une étape n''est pas autorisé. Utilisez « forcer » (admin uniquement) avec un commentaire.',
        'require_force', true
      );
    end if;
    if v_role not in ('admin', 'super_admin') then
      return jsonb_build_object('ok', false, 'reason', 'Seul un administrateur peut forcer un saut d''étape.');
    end if;
    if coalesce(trim(p_commentaire), '') = '' then
      return jsonb_build_object('ok', false, 'reason', 'Un commentaire est obligatoire pour forcer une transition.');
    end if;
  end if;

  -- Vérifie le ok + collecte les warnings
  v_can := public.project_can_advance(p_project_id, p_to_phase);
  if not (v_can->>'ok')::boolean then
    -- Le saut peut être contourné par force (déjà validé ci-dessus).
    if v_eff_step > 1 and p_force and (v_can->>'reason') like 'Sauter une étape%' then
      null;
    else
      return v_can;
    end if;
  end if;

  -- Application
  update public.projects set phase = p_to_phase where id = p_project_id;

  insert into public.project_phase_log (project_id, from_phase, to_phase, user_id, commentaire, forced)
  values (p_project_id, v_from, p_to_phase, v_user, nullif(trim(p_commentaire), ''),
          v_eff_step > 1 and p_force);

  return jsonb_build_object(
    'ok', true,
    'from_phase', v_from,
    'to_phase', p_to_phase,
    'warnings', coalesce(v_can->'warnings', '[]'::jsonb)
  );
end $$;

grant execute on function public.advance_project_phase(uuid, public.project_phase, text, boolean) to authenticated;

-- ─── 10. Sanity check : aucun projet existant ne reste sans type ─
-- Default 'investment' couvre tout le legacy. Les projets ré-typés
-- ultérieurement peuvent avoir une phase incompatible avec leur type :
-- côté app, on rebase phase = première phase du nouveau gabarit lors
-- du changement de type.

-- ═══════════════════════════════════════════════════════════════
-- Fin migration 028
-- ═══════════════════════════════════════════════════════════════
