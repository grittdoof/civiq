-- ═══════════════════════════════════════════════════════════════
-- 055 — Bucket privé « tickets-documents » : pièces jointes du
-- rapport de clôture d'un signalement (PDF, Word, Excel, OpenDocument,
-- texte ; 20 Mo).
--
-- Le code écrivait dans un bucket « tickets » qui n'a jamais existé :
-- aucune pièce n'a pu être enregistrée (ticket_rapports.document_paths
-- vide partout au 2026-11-07), rien à reprendre.
--
-- Aucune policy sur storage.objects : dépôt par lien signé préparé par
-- le serveur (service role), lecture par URL signée.
-- Idempotente. Retour arrière : supabase/rollback/055_tickets_documents_bucket_down.sql
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tickets-documents', 'tickets-documents', false, 20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
