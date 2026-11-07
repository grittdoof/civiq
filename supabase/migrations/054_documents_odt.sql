-- ═══════════════════════════════════════════════════════════════
-- 054 — Bucket « project-documents » : accepte les fichiers .odt
-- (compte rendu de séance déposé en fichier, LibreOffice).
-- Les fichiers sont désormais déposés directement par le navigateur
-- (lien de dépôt signé) : le bucket impose seul le format et la taille.
-- Idempotente. Retour arrière : supabase/rollback/054_documents_odt_down.sql
-- ═══════════════════════════════════════════════════════════════

update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'application/vnd.oasis.opendocument.text')
where id = 'project-documents'
  and allowed_mime_types is not null
  and not ('application/vnd.oasis.opendocument.text' = any (allowed_mime_types));
