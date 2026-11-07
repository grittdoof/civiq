-- Retour arrière de 056 : policies d'origine de la migration 010
-- (tout compte connecté lit et dépose ; suppression par l'auteur ou un admin).

drop policy if exists "tickets_photos_read" on storage.objects;
create policy "tickets_photos_read"
  on storage.objects for select
  using (bucket_id = 'tickets-photos' and auth.role() = 'authenticated');

drop policy if exists "tickets_photos_upload" on storage.objects;
create policy "tickets_photos_upload"
  on storage.objects for insert
  with check (bucket_id = 'tickets-photos' and auth.role() = 'authenticated');

drop policy if exists "tickets_photos_delete" on storage.objects;
create policy "tickets_photos_delete"
  on storage.objects for delete
  using (
    bucket_id = 'tickets-photos'
    and (owner = auth.uid() or public.my_role() in ('admin', 'super_admin'))
  );
