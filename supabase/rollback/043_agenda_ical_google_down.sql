-- Retour arrière de 043_agenda_ical_google.sql
-- Supprime uniquement des tables techniques (liens d'abonnement, connexions
-- Google). Aucune donnée métier. Les agendas « GoCiviq » déjà créés chez
-- Google restent chez les utilisateurs, qui peuvent les supprimer eux-mêmes.
drop table if exists public.google_calendar_events;
drop table if exists public.google_calendar_links;
drop table if exists public.calendar_feeds;
