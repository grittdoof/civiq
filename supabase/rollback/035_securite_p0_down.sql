-- ═══════════════════════════════════════════════════════════════
-- Retour arrière de 035_securite_p0.sql — restaure l'état antérieur
-- À n'exécuter qu'en cas de régression avérée : cet état est VULNÉRABLE
-- (élévation de privilège via make_super_admin, documents inter-communes).
-- Hors de supabase/migrations/ pour ne jamais être appliqué par `db push`.
-- ═══════════════════════════════════════════════════════════════

-- 1. RPC
grant execute on function public.make_super_admin(text)                    to public, anon, authenticated;
grant execute on function public.purge_old_audit_log(integer)              to public, anon, authenticated;
grant execute on function public.purge_inactive_push_subscriptions(integer) to public, anon, authenticated;
grant execute on function public.purge_old_soft_deletes()                  to public, anon, authenticated;
grant execute on function public.purge_expired_responses()                 to public, anon, authenticated;
grant execute on function public.log_audit(text, text, uuid, uuid, jsonb)  to public, anon, authenticated;
grant execute on function public.session_decision_to_milestone()           to public, anon, authenticated;

-- 2. Storage (policies de 017 et 019)
drop policy if exists "project_docs_read" on storage.objects;
create policy "project_docs_read" on storage.objects for select
  using (bucket_id = 'project-documents' and auth.role() = 'authenticated');
drop policy if exists "project_docs_upload" on storage.objects;
create policy "project_docs_upload" on storage.objects for insert
  with check (bucket_id = 'project-documents' and auth.role() = 'authenticated');
drop policy if exists "project_docs_delete" on storage.objects;
create policy "project_docs_delete" on storage.objects for delete
  using (bucket_id = 'project-documents' and (owner = auth.uid() or public.my_role() in ('admin', 'super_admin')));
drop policy if exists "commission_pdfs_read" on storage.objects;
create policy "commission_pdfs_read" on storage.objects for select
  using (bucket_id = 'commission-pdfs' and auth.role() = 'authenticated');
drop policy if exists "commission_pdfs_upload" on storage.objects;
create policy "commission_pdfs_upload" on storage.objects for insert
  with check (bucket_id = 'commission-pdfs' and auth.role() = 'authenticated');
drop policy if exists "commission_pdfs_delete" on storage.objects;
create policy "commission_pdfs_delete" on storage.objects for delete
  using (bucket_id = 'commission-pdfs' and public.my_role() in ('admin', 'super_admin'));
drop policy if exists "project_photos_upload" on storage.objects;
create policy "project_photos_upload" on storage.objects for insert
  with check (bucket_id = 'project-photos' and auth.role() = 'authenticated'
              and public.my_role() in ('admin', 'editor', 'super_admin'));
drop policy if exists "project_photos_update" on storage.objects;
create policy "project_photos_update" on storage.objects for update
  using (bucket_id = 'project-photos' and (owner = auth.uid() or public.my_role() in ('admin', 'super_admin')));
drop policy if exists "project_photos_delete" on storage.objects;
create policy "project_photos_delete" on storage.objects for delete
  using (bucket_id = 'project-photos' and (owner = auth.uid() or public.my_role() in ('admin', 'super_admin')));

-- 3. Émargement (policy de 018)
drop policy if exists "attendance_cud" on public.session_attendance;
create policy "attendance_cud" on public.session_attendance for all
  using (
    (conseiller_user_id is not null and conseiller_user_id = auth.uid())
    or exists (
      select 1 from public.commission_sessions s
        join public.commissions c on c.id = s.commission_id
       where s.id = session_attendance.session_id
         and public.user_can_access_commune(c.commune_id)
         and public.my_role() in ('admin', 'super_admin')
    )
  )
  with check (
    (conseiller_user_id is not null and conseiller_user_id = auth.uid())
    or exists (
      select 1 from public.commission_sessions s
        join public.commissions c on c.id = s.commission_id
       where s.id = session_attendance.session_id
         and public.user_can_access_commune(c.commune_id)
         and public.my_role() in ('admin', 'super_admin')
    )
  );

-- 4. Trigger (version de 017)
create or replace function public.session_decision_to_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phase public.project_phase;
begin
  if new.type = 'action' and new.project_id is not null then
    select phase into v_phase from public.projects where id = new.project_id;
    insert into public.milestones (project_id, phase, libelle, echeance, responsable_user_id)
    values (new.project_id, coalesce(v_phase, 'emergence'), new.libelle, new.echeance, new.responsable_user_id);
  end if;
  return new;
end $$;
