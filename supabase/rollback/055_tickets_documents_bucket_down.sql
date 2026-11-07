-- Retour arrière de 055. Refuse de supprimer un bucket non vide :
-- les pièces déposées sont des archives (rapports d'intervention).
-- storage.protect_delete() bloque les DELETE directs sur les tables
-- Storage : on l'autorise pour cette seule transaction.
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'tickets-documents') then
    raise exception 'Le bucket tickets-documents contient des fichiers : les archiver avant de le supprimer.';
  end if;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = 'tickets-documents';
end $$;
