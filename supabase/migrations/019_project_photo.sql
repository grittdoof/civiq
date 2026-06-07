-- ═══════════════════════════════════════════════════════════════
-- Migration 019 — Photo de couverture des projets
--
-- Permet d'illustrer un projet avec une photo (chantier, plan,
-- rendu d'archi). Affichée dans les cards de la vue Projets et
-- dans la fiche projet.
--
-- Bucket project-photos (public — lecture seule), même politique
-- que les logos de commune.
-- ═══════════════════════════════════════════════════════════════

alter table public.projects
  add column if not exists photo_url text,
  add column if not exists photo_storage_path text;

-- ─── Bucket Storage ────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-photos',
  'project-photos',
  true,
  5242880,                                       -- 5 MB max
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS — bucket public en lecture, écriture par éditeurs+
drop policy if exists "project_photos_read" on storage.objects;
create policy "project_photos_read" on storage.objects for select
  using (bucket_id = 'project-photos');

drop policy if exists "project_photos_upload" on storage.objects;
create policy "project_photos_upload" on storage.objects for insert
  with check (
    bucket_id = 'project-photos'
    and auth.role() = 'authenticated'
    and public.my_role() in ('admin', 'editor', 'super_admin')
  );

drop policy if exists "project_photos_delete" on storage.objects;
create policy "project_photos_delete" on storage.objects for delete
  using (
    bucket_id = 'project-photos'
    and (owner = auth.uid() or public.my_role() in ('admin', 'super_admin'))
  );

drop policy if exists "project_photos_update" on storage.objects;
create policy "project_photos_update" on storage.objects for update
  using (
    bucket_id = 'project-photos'
    and (owner = auth.uid() or public.my_role() in ('admin', 'super_admin'))
  );
