-- ═══════════════════════════════════════════════════════════════
-- 056 — Photos de signalement : accès Storage limité à la commune
--
-- Les policies de 010 autorisaient tout compte connecté (y compris un
-- « administré » sans commune) à lire et déposer dans le bucket privé
-- `tickets-photos`, toutes communes confondues.
--
-- Le dépôt reste fait par le navigateur avec la clé utilisateur
-- (TicketPhotoUpload, chemin `<commune_id>/<uuid>.jpg`), on garde donc
-- des policies, mais restreintes :
--   • dossier de premier niveau = commune de l'utilisateur
--     (`public.my_commune_id()`), rôle admin ou editor ;
--   • super_admin : toutes les communes ;
--   • suppression : auteur du fichier ou admin, dans sa commune.
-- La lecture applicative passe par le service role (URLs signées,
-- `getPhotoSignedUrl`) et n'est pas concernée.
--
-- Idempotente. Retour arrière : supabase/rollback/056_tickets_photos_policies_down.sql
-- ═══════════════════════════════════════════════════════════════

drop policy if exists "tickets_photos_read" on storage.objects;
create policy "tickets_photos_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tickets-photos'
    and (
      public.my_role() = 'super_admin'
      or (
        public.my_role() in ('admin', 'editor')
        and (storage.foldername(name))[1] = public.my_commune_id()::text
      )
    )
  );

drop policy if exists "tickets_photos_upload" on storage.objects;
create policy "tickets_photos_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tickets-photos'
    and (
      public.my_role() = 'super_admin'
      or (
        public.my_role() in ('admin', 'editor')
        and (storage.foldername(name))[1] = public.my_commune_id()::text
      )
    )
  );

drop policy if exists "tickets_photos_delete" on storage.objects;
create policy "tickets_photos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tickets-photos'
    and (
      public.my_role() = 'super_admin'
      or (
        (storage.foldername(name))[1] = public.my_commune_id()::text
        and (owner = auth.uid() or public.my_role() = 'admin')
      )
    )
  );
