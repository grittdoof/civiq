-- ═══════════════════════════════════════════════════════════════
-- Migration 031 — Bannière des sondages (mode événement)
--
-- Un sondage peut désormais servir de formulaire d'inscription à un
-- événement gratuit. Le visuel bannière affiché en tête de l'écran
-- d'accueil est stocké dans le bucket public `survey-banners`.
--
-- Les autres réglages du mode événement (CTA personnalisé, date,
-- lieu, coordonnées GPS) vivent dans `surveys.schema.settings`
-- (jsonb) — aucune colonne supplémentaire nécessaire.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'survey-banners',
  'survey-banners',
  true,
  5242880,                                       -- 5 MB max
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS — bucket public en lecture (le sondage est public),
-- écriture réservée aux éditeurs et administrateurs.
drop policy if exists "survey_banners_read" on storage.objects;
create policy "survey_banners_read" on storage.objects for select
  using (bucket_id = 'survey-banners');

drop policy if exists "survey_banners_upload" on storage.objects;
create policy "survey_banners_upload" on storage.objects for insert
  with check (
    bucket_id = 'survey-banners'
    and auth.role() = 'authenticated'
    and public.my_role() in ('admin', 'editor', 'super_admin')
  );

drop policy if exists "survey_banners_update" on storage.objects;
create policy "survey_banners_update" on storage.objects for update
  using (
    bucket_id = 'survey-banners'
    and (owner = auth.uid() or public.my_role() in ('admin', 'super_admin'))
  );

drop policy if exists "survey_banners_delete" on storage.objects;
create policy "survey_banners_delete" on storage.objects for delete
  using (
    bucket_id = 'survey-banners'
    and (owner = auth.uid() or public.my_role() in ('admin', 'super_admin'))
  );
