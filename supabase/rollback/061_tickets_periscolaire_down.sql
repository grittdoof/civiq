-- Retour arrière de 061. Les précisions périscolaires et les sites sont
-- supprimés : exporter auparavant. Le service « Périscolaire » créé est
-- conservé (il peut porter des tickets).
drop function if exists public.purger_donnees_enfants();
drop function if exists public.date_effacement_enfant(timestamptz, integer);
alter table public.commune_settings drop column if exists tickets_effacement_enfant_mois;
alter table public.ticket_categories drop column if exists notifier_fonctions;
drop table if exists public.ticket_periscolaire;
drop table if exists public.sites;
