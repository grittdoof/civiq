-- ═══════════════════════════════════════════════════════════════
-- 051 — Commissions & agenda
--
-- • Copie au secrétariat : commune_settings.copie_emails (liste de la
--   commune) ; commissions.copie_emails (NULL = liste de la commune,
--   tableau = liste propre à la commission, vide = personne).
-- • Titulaire / suppléant : commission_members.statut_membre ;
--   commissions.convoquer_suppleants (réglage par commission).
-- • Compte rendu déposé en fichier (PDF / Word) au lieu d'être rédigé :
--   commission_sessions.cr_fichier_* (bucket privé project-documents).
-- • Agenda filtré par commission : calendar_feeds.commissions et
--   google_calendar_links.commissions (NULL = toutes).
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

alter table public.commune_settings
  add column if not exists copie_emails text[] not null default '{}';

alter table public.commissions
  add column if not exists copie_emails text[],
  add column if not exists convoquer_suppleants boolean not null default false;

alter table public.commission_members
  add column if not exists statut_membre text not null default 'titulaire';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'commission_members_statut_membre_check') then
    alter table public.commission_members
      add constraint commission_members_statut_membre_check check (statut_membre in ('titulaire', 'suppleant'));
  end if;
end $$;

alter table public.commission_sessions
  add column if not exists cr_fichier_path text,
  add column if not exists cr_fichier_nom  text,
  add column if not exists cr_fichier_type text,
  add column if not exists cr_fichier_par  uuid,
  add column if not exists cr_fichier_le   timestamptz;

alter table public.calendar_feeds
  add column if not exists commissions uuid[];
alter table public.google_calendar_links
  add column if not exists commissions uuid[];
