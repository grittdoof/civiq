-- Retour arrière de 051 — ⚠ perd les listes de copie, le statut
-- titulaire/suppléant, le lien vers les comptes rendus déposés (les
-- fichiers restent dans le bucket) et les filtres de commission des agendas.
alter table public.google_calendar_links drop column if exists commissions;
alter table public.calendar_feeds drop column if exists commissions;
alter table public.commission_sessions
  drop column if exists cr_fichier_le, drop column if exists cr_fichier_par,
  drop column if exists cr_fichier_type, drop column if exists cr_fichier_nom,
  drop column if exists cr_fichier_path;
alter table public.commission_members drop constraint if exists commission_members_statut_membre_check;
alter table public.commission_members drop column if exists statut_membre;
alter table public.commissions drop column if exists convoquer_suppleants, drop column if exists copie_emails;
alter table public.commune_settings drop column if exists copie_emails;
