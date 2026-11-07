-- Retour arrière de 060 : la page publique disparaît (réglages perdus).
alter table public.commune_settings
  drop column if exists tickets_public_categories,
  drop column if exists tickets_public_actif;
