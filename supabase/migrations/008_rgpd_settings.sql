-- ═══════════════════════════════════════════════════════════════
-- Migration 008 — Conformité RGPD plateforme + module formulaire
--
-- 1. platform_settings : table singleton (id='global') stockant les
--    informations RGPD obligatoires de la plateforme :
--      • éditeur (nom, adresse, SIRET, mail, tél)
--      • hébergeur
--      • DPO (nom, email)
--      • base légale, durée de conservation, droit d'accès
--      • CNIL : numéro de déclaration / cadre
--
-- 2. surveys.rgpd : champs ajoutés à chaque sondage
--      • finalite (texte court — finalité du traitement)
--      • base_legale (consentement, intérêt légitime, mission de
--         service public, etc.)
--      • duree_conservation_jours (default 365)
--      • destinataires (qui voit les données)
--      • require_consent (boolean, default true) → checkbox CGU
--         affichée avant submit dans le SurveyRenderer
--
-- 3. responses : ajoute consent_given (audit du clic CGU) et
--    consent_text (snapshot du texte au moment de la soumission)
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. platform_settings ───
create table if not exists public.platform_settings (
  id            text primary key default 'global'  check (id = 'global'),
  -- Éditeur
  editor_name        text,
  editor_legal_form  text,                     -- SARL, SAS, association…
  editor_siret       text,
  editor_address     text,
  editor_email       text,
  editor_phone       text,
  -- Représentant légal
  legal_rep_name     text,
  legal_rep_role     text,
  -- Hébergeur
  host_name          text default 'Vercel Inc.',
  host_address       text default '440 N Barranca Ave #4133, Covina, CA 91723, USA',
  host_phone         text,
  -- DPO
  dpo_name           text,
  dpo_email          text,
  -- Conformité
  cnil_ref           text,                     -- ex : « non concernée », « art. 6.1.e »
  privacy_email      text,                     -- pour exercer ses droits
  retention_default_days integer default 365,
  -- Tracking
  updated_at         timestamptz default now(),
  updated_by         uuid references auth.users(id)
);

-- Insert ligne unique si absente
insert into public.platform_settings (id) values ('global')
  on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

-- RLS : lecture pour tous (utilisée dans /mentions-legales etc.) ;
-- écriture super-admin only.
drop policy if exists "Anyone can read platform_settings" on public.platform_settings;
create policy "Anyone can read platform_settings"
  on public.platform_settings for select using (true);

drop policy if exists "Super-admins can update platform_settings" on public.platform_settings;
create policy "Super-admins can update platform_settings"
  on public.platform_settings for update
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

-- ─── 2. RGPD champs sur surveys ───
alter table public.surveys
  add column if not exists rgpd_finalite text,
  add column if not exists rgpd_base_legale text default 'consentement',
  add column if not exists rgpd_duree_conservation_jours integer default 365,
  add column if not exists rgpd_destinataires text,
  add column if not exists rgpd_require_consent boolean default true,
  add column if not exists rgpd_consent_text text default
    'Je consens à ce que mes réponses soient collectées et analysées par la commune dans le cadre de cette consultation. Je peux exercer mes droits (accès, rectification, suppression) en contactant la commune.';

-- ─── 3. Audit du consentement sur responses ───
alter table public.responses
  add column if not exists consent_given boolean default false,
  add column if not exists consent_text  text,
  add column if not exists consent_at    timestamptz;

-- ─── 4. Fonction RPC : purge automatique des réponses expirées ───
-- À planifier en cron côté Supabase ; idempotente.
create or replace function public.purge_expired_responses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer := 0;
  deleted integer;
begin
  delete from public.responses r
   using public.surveys s
   where r.survey_id = s.id
     and s.rgpd_duree_conservation_jours is not null
     and s.rgpd_duree_conservation_jours > 0
     and r.submitted_at < now() - (s.rgpd_duree_conservation_jours || ' days')::interval;
  get diagnostics deleted = row_count;
  total := total + deleted;
  return total;
end;
$$;

grant execute on function public.purge_expired_responses() to service_role;
