-- ═══════════════════════════════════════════════════════════════
-- Lot A — rattachement des 39 projets de Châteauneuf aux 3 types
-- (audit §1.7, validé le 25/09/2026, décision Q7).
--
-- Données, pas schéma : script ponctuel, à exécuter une fois APRÈS les
-- migrations 036 à 038. Aucune suppression : archivage (archived_at).
-- Chaque ligne est gardée par son titre et son état d'origine : si le
-- projet a été modifié entre-temps, il n'est pas touché.
-- Annulation : supabase/data/lot_a_rattachement_chateauneuf_down.sql
-- ═══════════════════════════════════════════════════════════════

-- 1. Les 34 projets restants gardent le type choisi par l'utilisateur
--    (type_code rempli par la migration 037 : investment → investissement,
--    event → evenementiel, tracking → suivi_simple).

-- 2. Brouillons vides « Sans titre » (création silencieuse), sans aucune
--    donnée liée → archivés.
update public.projects p
   set archived_at = now(),
       archive_motif = 'Brouillon vide créé automatiquement (création silencieuse) — archivé au lot A'
 where p.id in (
         '1578e0d2-bf92-494b-98aa-5ac6730b1591', 'f71e7a7e-5e4a-4530-a74b-397efb7192a4',
         '22de0d5f-9d15-4cf5-b008-42161cfbe6da', 'eb02d0f0-07d2-4351-8e0c-26690e170944',
         'b18c6111-c3ca-48cf-b3e5-5b0242f35182', '85d3ab26-131e-4f47-a5f6-53443d40327b',
         '99260e5e-7a89-4e02-853a-e00079c666bf', '9c72b284-af99-43b6-89ff-3902bd36a805'
       )
   and p.titre = 'Sans titre'
   and p.archived_at is null
   and coalesce(p.description, '') = ''
   and not exists (select 1 from public.milestones m where m.project_id = p.id)
   and not exists (select 1 from public.project_documents d where d.project_id = p.id)
   and not exists (select 1 from public.financings f where f.project_id = p.id)
   and not exists (select 1 from public.commission_projects c where c.project_id = p.id);

-- 3. Projet de test.
update public.projects
   set archived_at = now(), archive_motif = 'Projet de test — archivé au lot A'
 where id = '5e1049f3-004e-4988-a992-f6a102a87228' and titre = 'test' and archived_at is null;

-- 4. Doublons : on garde celui qui porte des données.
--    « Lotissement La Gourlière 2 » (vide) doublonne « Lotissement Gourliere 2 ».
update public.projects
   set archived_at = now(), archive_motif = 'Doublon de « Lotissement Gourliere 2 » — archivé au lot A'
 where id = '77480d3a-0108-4500-b3b1-db6e421d337c' and archived_at is null;
--    « Audit Fioul, GO et GNR » créé en événement (vide) doublonne la version suivi.
update public.projects
   set archived_at = now(), archive_motif = 'Doublon (créé en événement) de « Audit Fioul, GO et GNR » — archivé au lot A'
 where id = 'e0eb96ee-c147-47c7-9881-e670d454530b' and type = 'event' and archived_at is null;

-- 5. Mal typé : l'adhésion à un réseau n'est pas un investissement.
update public.projects
   set type_code = 'suivi_simple'
 where id = 'a9b7ff75-9ccc-40e3-bf63-c2f61f9fdd0a' and type_code = 'investissement';

-- Contrôle : 28 projets actifs attendus (39 − 11 archivés) : 6 investissement, 2 evenementiel, 20 suivi_simple.
select type_code, count(*) filter (where archived_at is null) as actifs, count(*) filter (where archived_at is not null) as archives
  from public.projects group by type_code order by type_code;
