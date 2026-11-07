-- Retour arrière de 054 : retire .odt des formats du bucket project-documents.
update storage.buckets
set allowed_mime_types = array_remove(allowed_mime_types, 'application/vnd.oasis.opendocument.text')
where id = 'project-documents';
