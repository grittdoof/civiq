-- ═══════════════════════════════════════════════════════════════
-- 046 — Émargement : tous les membres, trois statuts
--
-- Constat (séance créée sans convocation) : la feuille d'émargement et le
-- compte rendu ne listaient que les membres déjà pointés. Désormais :
--   • session_attendance.statut : 'present' | 'excuse' | 'absent'
--     (NULL = non renseigné), synchronisé avec l'ancien booléen `present` ;
--   • ensure_session_attendance(session) : une ligne par membre actif de
--     la commission — appelée à la création de la séance, à l'ajout d'un
--     membre et à l'ouverture de la séance tant que le compte rendu n'est
--     pas validé. La liste figée de la séance survit au départ d'un membre.
--
-- Additive, idempotente, compatible avec le code en ligne.
-- Retour arrière : supabase/rollback/046_emargement_tous_membres_down.sql
-- ═══════════════════════════════════════════════════════════════

alter table public.session_attendance add column if not exists statut text;
do $$ begin
  alter table public.session_attendance add constraint session_attendance_statut_check
    check (statut is null or statut in ('present', 'excuse', 'absent'));
exception when duplicate_object then null; end $$;

-- Reprise : présent → present, absent → absent.
update public.session_attendance
   set statut = case when present then 'present' else 'absent' end
 where statut is null and present is not null;

-- Synchronisation statut ↔ present (l'ancien code n'écrit que `present`).
create or replace function public.session_attendance_sync_statut()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.statut is not null then
      new.present := new.statut = 'present';
    elsif new.present is not null then
      new.statut := case when new.present then 'present' else 'absent' end;
    end if;
  elsif new.statut is distinct from old.statut then
    new.present := case when new.statut is null then null else new.statut = 'present' end;
  elsif new.present is distinct from old.present then
    new.statut := case
      when new.present is null then null
      when new.present then 'present'
      when old.statut = 'excuse' then 'excuse'
      else 'absent' end;
  end if;
  return new;
end $$;

drop trigger if exists trg_session_attendance_statut on public.session_attendance;
create trigger trg_session_attendance_statut
  before insert or update on public.session_attendance
  for each row execute function public.session_attendance_sync_statut();

-- Une ligne par membre actif (internes par compte, externes par fiche membre).
create or replace function public.ensure_session_attendance(p_session_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; k integer;
begin
  insert into public.session_attendance (session_id, conseiller_user_id)
  select s.id, m.user_id
    from public.commission_sessions s
    join public.commission_members m on m.commission_id = s.commission_id and m.deleted_at is null
   where s.id = p_session_id and m.user_id is not null
     and not exists (select 1 from public.session_attendance a where a.session_id = s.id and a.conseiller_user_id = m.user_id);
  get diagnostics k = row_count; n := n + k;

  insert into public.session_attendance (session_id, commission_member_id)
  select s.id, m.id
    from public.commission_sessions s
    join public.commission_members m on m.commission_id = s.commission_id and m.deleted_at is null
   where s.id = p_session_id and m.user_id is null
     and not exists (select 1 from public.session_attendance a where a.session_id = s.id and a.commission_member_id = m.id);
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;
revoke execute on function public.ensure_session_attendance(uuid) from public, anon, authenticated;
grant execute on function public.ensure_session_attendance(uuid) to service_role;

-- Rattrapage : séances dont le compte rendu n'est pas encore validé.
do $$
declare r record;
begin
  for r in select id from public.commission_sessions where deleted_at is null and not coalesce(compte_rendu_valide, false) loop
    perform public.ensure_session_attendance(r.id);
  end loop;
end $$;
