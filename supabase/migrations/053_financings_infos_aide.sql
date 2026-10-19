-- ═══════════════════════════════════════════════════════════════
-- 053 — Demande de subvention créée depuis Aides-territoires : on garde
-- le lien vers la démarche et les informations utiles de l'aide.
--
-- Auparavant seuls le financeur, le nom du dispositif et l'identifiant
-- (aide_ref) étaient conservés : une aide trouvée par recherche (hors
-- cache) perdait son lien. Désormais copiés à la création :
--   aide_url (fiche Aides-territoires), aide_url_candidature (dépôt chez
--   le financeur), aide_date_limite, aide_infos (description, thématiques,
--   natures d'aide, périmètre, récurrence, appel à projets, organismes).
-- Rattrapage des demandes existantes depuis aides_cache. Additive.
-- ═══════════════════════════════════════════════════════════════

alter table public.financings
  add column if not exists aide_url             text,
  add column if not exists aide_url_candidature text,
  add column if not exists aide_date_limite     date,
  add column if not exists aide_infos           jsonb;

update public.financings f
   set aide_url = coalesce(f.aide_url, case when c.url like '/%' then 'https://aides-territoires.beta.gouv.fr' || c.url else c.url end),
       aide_url_candidature = coalesce(f.aide_url_candidature, c.url_candidature),
       aide_date_limite = coalesce(f.aide_date_limite, c.date_limite),
       aide_infos = coalesce(f.aide_infos, jsonb_build_object(
         'description', left(c.description, 1200),
         'categories', to_jsonb(c.categories),
         'types_aide', to_jsonb(c.types_aide),
         'financeurs', to_jsonb(c.financeurs),
         'perimetre', c.perimetre,
         'recurrence', c.recurrence,
         'appel_a_projets', c.appel_a_projets))
  from public.projects p, public.aides_cache c
 where f.source = 'api'
   and f.aide_ref is not null
   and p.id = f.project_id
   and c.commune_id = p.commune_id
   and c.aide_id = f.aide_ref
   and f.aide_url is null;
