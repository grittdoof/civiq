-- Retour arrière de 052 : rétablit les règles de suppression d'origine.
-- ⚠ Les suppressions de comptes rebloquent dès qu'il y a de l'historique,
-- et supprimer un élu efface de nouveau ses appartenances et émargements.
-- Le rattachement des émargements anciens à leur membre est conservé.
drop trigger if exists trg_profiles_conserver_historique on public.profiles;
drop function if exists public.profiles_conserver_historique();
do $$
declare r record;
begin
  for r in select * from (values
    ('commune_invitations', 'invited_by',   'public.profiles', 'commune_invitations_invited_by_fkey', 'no action'),
    ('commune_modules',     'activated_by', 'public.profiles', 'commune_modules_activated_by_fkey', 'no action'),
    ('commune_requests',    'reviewed_by',  'auth.users',      'commune_requests_reviewed_by_fkey', 'no action'),
    ('platform_settings',   'updated_by',   'auth.users',      'platform_settings_updated_by_fkey', 'no action'),
    ('responses',           'deleted_by',   'auth.users',      'responses_deleted_by_fkey', 'no action'),
    ('surveys',             'created_by',   'public.profiles', 'surveys_created_by_fkey', 'no action'),
    ('surveys',             'deleted_by',   'auth.users',      'surveys_deleted_by_fkey', 'no action'),
    ('ticket_assignees',    'assigned_by',  'public.profiles', 'ticket_assignees_assigned_by_fkey', 'no action'),
    ('ticket_commentaires', 'auteur_id',    'public.profiles', 'ticket_commentaires_auteur_id_fkey', 'no action'),
    ('ticket_photos',       'uploaded_by',  'public.profiles', 'ticket_photos_uploaded_by_fkey', 'no action'),
    ('ticket_rapports',     'redige_par',   'public.profiles', 'ticket_rapports_redige_par_fkey', 'no action'),
    ('tickets',             'assigne_a',    'public.profiles', 'tickets_assigne_a_fkey', 'no action'),
    ('tickets',             'clos_by',      'public.profiles', 'tickets_clos_by_fkey', 'no action'),
    ('tickets',             'created_by',   'public.profiles', 'tickets_created_by_fkey', 'no action'),
    ('commission_members',  'user_id',      'public.profiles', 'commission_members_user_id_fkey', 'cascade'),
    ('session_attendance',  'conseiller_user_id', 'public.profiles', 'session_attendance_conseiller_user_id_fkey', 'cascade')
  ) as t(tbl, col, ref, nom, regle)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.nom);
    execute format('alter table public.%I add constraint %I foreign key (%I) references %s(id) on delete %s',
                   r.tbl, r.nom, r.col, r.ref, r.regle);
  end loop;
end $$;
