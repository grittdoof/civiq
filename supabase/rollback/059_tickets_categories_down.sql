-- Retour arrière de 059. Les colonnes historiques `categorie` et
-- `priorite` sont restées synchronisées : rien n'est perdu pour l'ancien
-- code. Les sous-catégories, urgences « danger immédiat », délais cibles
-- et transmissions saisis depuis sont supprimés : exporter auparavant.

drop trigger if exists trg_tickets_sync_categorie_urgence on public.tickets;
drop function if exists public.tickets_sync_categorie_urgence();
alter table public.tickets drop constraint if exists tickets_urgence_check;
alter table public.tickets
  drop column if exists transmis_reference,
  drop column if exists transmis_le,
  drop column if exists transmis_a,
  drop column if exists delai_cible_le,
  drop column if exists urgence,
  drop column if exists categorie_id;
drop trigger if exists trg_communes_ticket_categories on public.communes;
drop function if exists public.tg_communes_ticket_categories();
drop function if exists public.ticket_categories_seed(uuid);
drop table if exists public.ticket_categories;
