-- Annulation du rattachement lot A : désarchive et rétablit le type d'origine.
update public.projects
   set archived_at = null, archived_by = null, archive_motif = null
 where archive_motif like '%archivé au lot A';

update public.projects
   set type_code = 'investissement', phase = 'emergence'
 where id = 'a9b7ff75-9ccc-40e3-bf63-c2f61f9fdd0a' and type_code = 'suivi_simple';
