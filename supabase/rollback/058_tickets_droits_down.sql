-- Retour arrière de 058 : rétablit la visibilité « toute la commune »
-- (policies de 010/012). Les données ajoutées (services, matrice,
-- destinataires, colonnes service_id / confidentialite) sont supprimées :
-- exporter auparavant si des signalements restreints ou confidentiels
-- ont été créés.

drop policy if exists "tickets_select_visible" on public.tickets;
create policy "tickets_select_own_commune"
  on public.tickets for select
  using (public.user_can_access_commune(commune_id));

drop policy if exists "tickets_update_admin_or_assigne" on public.tickets;
create policy "tickets_update_admin_or_assigne"
  on public.tickets for update
  using (
    public.user_can_access_commune(commune_id)
    and (public.my_role() in ('admin', 'super_admin') or assigne_a = auth.uid() or created_by = auth.uid())
  );

drop policy if exists "ticket_photos_select" on public.ticket_photos;
create policy "ticket_photos_select" on public.ticket_photos for select
  using (exists (select 1 from public.tickets t where t.id = ticket_id and public.user_can_access_commune(t.commune_id)));
drop policy if exists "ticket_photos_insert" on public.ticket_photos;
create policy "ticket_photos_insert" on public.ticket_photos for insert
  with check (exists (select 1 from public.tickets t where t.id = ticket_id and public.user_can_access_commune(t.commune_id)));
drop policy if exists "ticket_comments_select" on public.ticket_commentaires;
create policy "ticket_comments_select" on public.ticket_commentaires for select
  using (exists (select 1 from public.tickets t where t.id = ticket_id and public.user_can_access_commune(t.commune_id)));
drop policy if exists "ticket_comments_insert" on public.ticket_commentaires;
create policy "ticket_comments_insert" on public.ticket_commentaires for insert
  with check (exists (select 1 from public.tickets t where t.id = ticket_id and public.user_can_access_commune(t.commune_id)));
drop policy if exists "ticket_rapports_select" on public.ticket_rapports;
create policy "ticket_rapports_select" on public.ticket_rapports for select
  using (exists (select 1 from public.tickets t where t.id = ticket_id and public.user_can_access_commune(t.commune_id)));
drop policy if exists "ticket_assignees_select" on public.ticket_assignees;
create policy "ticket_assignees_select" on public.ticket_assignees for select
  using (exists (select 1 from public.tickets t where t.id = ticket_id and public.user_can_access_commune(t.commune_id)));

drop function if exists public.user_voit_ticket(uuid);
drop table if exists public.ticket_destinataires;
alter table public.tickets drop constraint if exists tickets_confidentialite_check;
alter table public.tickets drop column if exists confidentialite;
alter table public.tickets drop column if exists service_id;
drop trigger if exists trg_communes_ticket_matrice on public.communes;
drop function if exists public.tg_communes_ticket_matrice();
drop function if exists public.ticket_matrice_seed(uuid, boolean);
drop table if exists public.ticket_matrice;
drop table if exists public.service_membres;
drop table if exists public.services;
drop function if exists public.ticket_fonction(text);
-- La contrainte profiles_job_title_check élargie est conservée (sans risque).
