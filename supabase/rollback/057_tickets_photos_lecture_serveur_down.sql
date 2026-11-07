-- Retour arrière de 057 : rétablit la lecture des photos de sa commune
-- par tout admin ou éditeur (policy de 056).

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
