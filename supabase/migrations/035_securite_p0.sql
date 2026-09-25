-- ═══════════════════════════════════════════════════════════════
-- 035 — Correctifs de sécurité P0 (audit docs/audit-module-projets.md §0.1, §1.5)
--
-- 1. RPC d'administration exécutables par anon/authenticated
--    (make_super_admin = élévation de privilège, purges = effacement).
--    Postgres accorde EXECUTE à PUBLIC par défaut et Supabase y ajoute
--    anon/authenticated : la migration 014 n'avait jamais révoqué.
--    Les crons tournent en `postgres`, les routes en service_role → non impactés.
-- 2. Storage project-documents / commission-pdfs lisibles et inscriptibles
--    par tout compte connecté, toutes communes confondues. Tous les accès
--    applicatifs passent par le service role (routes API) → on retire les
--    policies ; seules les URLs signées générées côté serveur donnent accès.
--    Même traitement pour l'écriture de project-photos (lecture publique inchangée).
-- 3. session_attendance : la branche « soi-même » ne vérifiait ni la commune
--    ni la séance → émargement possible dans n'importe quelle séance.
-- 4. Trigger session_decision_to_milestone (SECURITY DEFINER) : pouvait
--    écrire un jalon dans le projet d'une autre commune.
--
-- Idempotente. Retour arrière : supabase/rollback/035_securite_p0_down.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. RPC d'administration : service_role uniquement ───
revoke execute on function public.make_super_admin(text)                  from public, anon, authenticated;
revoke execute on function public.purge_old_audit_log(integer)            from public, anon, authenticated;
revoke execute on function public.purge_inactive_push_subscriptions(integer) from public, anon, authenticated;
revoke execute on function public.purge_old_soft_deletes()                from public, anon, authenticated;
revoke execute on function public.purge_expired_responses()               from public, anon, authenticated;
revoke execute on function public.log_audit(text, text, uuid, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.make_super_admin(text)                   to service_role;
grant execute on function public.purge_old_audit_log(integer)             to service_role;
grant execute on function public.purge_inactive_push_subscriptions(integer) to service_role;
grant execute on function public.purge_old_soft_deletes()                 to service_role;
grant execute on function public.purge_expired_responses()                to service_role;
grant execute on function public.log_audit(text, text, uuid, uuid, jsonb)  to service_role;

-- ─── 2. Storage : plus d'accès direct aux documents ───
drop policy if exists "project_docs_read"      on storage.objects;
drop policy if exists "project_docs_upload"    on storage.objects;
drop policy if exists "project_docs_delete"    on storage.objects;
drop policy if exists "commission_pdfs_read"   on storage.objects;
drop policy if exists "commission_pdfs_upload" on storage.objects;
drop policy if exists "commission_pdfs_delete" on storage.objects;
-- project-photos : bucket public en lecture (policy project_photos_read
-- conservée) ; l'écriture passe par /api/projects/:id/photo (service role).
drop policy if exists "project_photos_upload"  on storage.objects;
drop policy if exists "project_photos_update"  on storage.objects;
drop policy if exists "project_photos_delete"  on storage.objects;

-- ─── 3. Émargement : « soi-même » borné à une séance de sa commune ───
drop policy if exists "attendance_cud" on public.session_attendance;
create policy "attendance_cud" on public.session_attendance
  for all
  using (
    exists (
      select 1
        from public.commission_sessions s
        join public.commissions c on c.id = s.commission_id
       where s.id = session_attendance.session_id
         and public.user_can_access_commune(c.commune_id)
         and (
           (session_attendance.conseiller_user_id is not null
             and session_attendance.conseiller_user_id = auth.uid())
           or public.my_role() in ('admin', 'super_admin')
         )
    )
  )
  with check (
    exists (
      select 1
        from public.commission_sessions s
        join public.commissions c on c.id = s.commission_id
       where s.id = session_attendance.session_id
         and public.user_can_access_commune(c.commune_id)
         and (
           (session_attendance.conseiller_user_id is not null
             and session_attendance.conseiller_user_id = auth.uid())
           or public.my_role() in ('admin', 'super_admin')
         )
    )
  );

-- ─── 4. Décision « action » → jalon : même commune uniquement ───
create or replace function public.session_decision_to_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase public.project_phase;
begin
  if new.type = 'action' and new.project_id is not null then
    select p.phase into v_phase
      from public.projects p
      join public.commission_sessions s on s.id = new.session_id
      join public.commissions c on c.id = s.commission_id
     where p.id = new.project_id
       and p.commune_id = c.commune_id;
    -- Projet d'une autre commune (ou introuvable) : aucun jalon créé.
    if v_phase is not null then
      insert into public.milestones (project_id, phase, libelle, echeance, responsable_user_id)
      values (new.project_id, v_phase, new.libelle, new.echeance, new.responsable_user_id);
    end if;
  end if;
  return new;
end
$$;
revoke execute on function public.session_decision_to_milestone() from public, anon, authenticated;
