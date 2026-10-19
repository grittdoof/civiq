-- ═══════════════════════════════════════════════════════════════
-- 052 — Supprimer un compte utilisateur sans perdre l'historique
--
-- Constat : la suppression d'un compte échouait (« Database error
-- deleting user ») dès qu'il avait de l'historique (signalements créés
-- ou clôturés, rapports, sondages…) : 14 clés étrangères en NO ACTION.
-- À l'inverse, deux clés en CASCADE auraient effacé des archives :
-- ses appartenances aux commissions et ses lignes d'émargement.
--
-- • Les 14 clés « auteur » passent en ON DELETE SET NULL (l'historique
--   reste, l'auteur devient « utilisateur supprimé »).
-- • commission_members.user_id et session_attendance.conseiller_user_id
--   passent en SET NULL ; un déclencheur, avant la suppression du
--   profil, transforme ses appartenances en membres nommés (nom
--   conservé) et rattache ses émargements anciens à son appartenance.
-- • Rattrapage : émargements anciens rattachés à leur membre.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

do $$
declare r record;
begin
  for r in select * from (values
    ('commune_invitations', 'invited_by',   'public.profiles', 'commune_invitations_invited_by_fkey'),
    ('commune_modules',     'activated_by', 'public.profiles', 'commune_modules_activated_by_fkey'),
    ('commune_requests',    'reviewed_by',  'auth.users',      'commune_requests_reviewed_by_fkey'),
    ('platform_settings',   'updated_by',   'auth.users',      'platform_settings_updated_by_fkey'),
    ('responses',           'deleted_by',   'auth.users',      'responses_deleted_by_fkey'),
    ('surveys',             'created_by',   'public.profiles', 'surveys_created_by_fkey'),
    ('surveys',             'deleted_by',   'auth.users',      'surveys_deleted_by_fkey'),
    ('ticket_assignees',    'assigned_by',  'public.profiles', 'ticket_assignees_assigned_by_fkey'),
    ('ticket_commentaires', 'auteur_id',    'public.profiles', 'ticket_commentaires_auteur_id_fkey'),
    ('ticket_photos',       'uploaded_by',  'public.profiles', 'ticket_photos_uploaded_by_fkey'),
    ('ticket_rapports',     'redige_par',   'public.profiles', 'ticket_rapports_redige_par_fkey'),
    ('tickets',             'assigne_a',    'public.profiles', 'tickets_assigne_a_fkey'),
    ('tickets',             'clos_by',      'public.profiles', 'tickets_clos_by_fkey'),
    ('tickets',             'created_by',   'public.profiles', 'tickets_created_by_fkey'),
    ('commission_members',  'user_id',      'public.profiles', 'commission_members_user_id_fkey'),
    ('session_attendance',  'conseiller_user_id', 'public.profiles', 'session_attendance_conseiller_user_id_fkey')
  ) as t(tbl, col, ref, nom)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.nom);
    execute format('alter table public.%I add constraint %I foreign key (%I) references %s(id) on delete set null',
                   r.tbl, r.nom, r.col, r.ref);
  end loop;
end $$;

-- Rattrapage : émargements anciens (compte seul) rattachés à leur membre.
update public.session_attendance a
   set commission_member_id = m.id
  from public.commission_sessions s, public.commission_members m
 where a.commission_member_id is null
   and a.conseiller_user_id is not null
   and s.id = a.session_id
   and m.commission_id = s.commission_id
   and m.user_id = a.conseiller_user_id
   and not exists (select 1 from public.session_attendance x where x.session_id = a.session_id and x.commission_member_id = m.id);

create or replace function public.profiles_conserver_historique()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Le membre de commission reste nommé (feuilles d'émargement, comptes rendus).
  update public.commission_members
     set external_name = coalesce(nullif(btrim(external_name), ''), nullif(btrim(old.full_name), ''), 'Ancien membre')
   where user_id = old.id;
  -- Émargements anciens : rattachés à l'appartenance avant que le lien au compte disparaisse.
  update public.session_attendance a
     set commission_member_id = m.id
    from public.commission_sessions s, public.commission_members m
   where a.conseiller_user_id = old.id
     and a.commission_member_id is null
     and s.id = a.session_id
     and m.commission_id = s.commission_id
     and m.user_id = old.id
     and not exists (select 1 from public.session_attendance x where x.session_id = a.session_id and x.commission_member_id = m.id);
  return old;
end
$$;

revoke execute on function public.profiles_conserver_historique() from public, anon, authenticated;

drop trigger if exists trg_profiles_conserver_historique on public.profiles;
create trigger trg_profiles_conserver_historique
  before delete on public.profiles
  for each row execute function public.profiles_conserver_historique();
