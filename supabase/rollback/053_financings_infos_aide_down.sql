-- Retour arrière de 053 — ⚠ perd les liens et informations d'aide
-- copiés sur les demandes (l'identifiant aide_ref reste).
alter table public.financings
  drop column if exists aide_infos,
  drop column if exists aide_date_limite,
  drop column if exists aide_url_candidature,
  drop column if exists aide_url;
