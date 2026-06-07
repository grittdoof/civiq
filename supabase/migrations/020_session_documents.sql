-- ═══════════════════════════════════════════════════════════════
-- Migration 020 — Documents attachés aux séances de commission
--
-- Permet d'attacher des documents (présentations, annexes,
-- rapports) directement à une séance et de les retrouver depuis
-- l'ordre du jour ou le compte rendu.
--
-- Réutilise le bucket privé project-documents (signed URLs).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.session_documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.commission_sessions(id) on delete cascade,
  nom text not null,
  url text not null,
  storage_path text,
  type text not null default 'annexe'
    check (type in ('ordre_du_jour', 'presentation', 'rapport', 'annexe', 'autre')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
create index if not exists idx_session_docs on public.session_documents(session_id);

alter table public.session_documents enable row level security;

drop policy if exists "session_docs_select" on public.session_documents;
create policy "session_docs_select" on public.session_documents for select
  using (exists (
    select 1 from public.commission_sessions s
    join public.commissions c on c.id = s.commission_id
    where s.id = session_id and public.user_can_access_commune(c.commune_id)
  ));

drop policy if exists "session_docs_cud" on public.session_documents;
create policy "session_docs_cud" on public.session_documents for all
  using (exists (
    select 1 from public.commission_sessions s
    join public.commissions c on c.id = s.commission_id
    where s.id = session_id
      and public.user_can_access_commune(c.commune_id)
      and public.my_role() in ('admin', 'editor', 'super_admin')
  ))
  with check (exists (
    select 1 from public.commission_sessions s
    join public.commissions c on c.id = s.commission_id
    where s.id = session_id
      and public.user_can_access_commune(c.commune_id)
      and public.my_role() in ('admin', 'editor', 'super_admin')
  ));
