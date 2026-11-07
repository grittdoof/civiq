-- ═══════════════════════════════════════════════════════════════
-- 057 — Photos de signalement : plus de lecture directe du bucket
--
-- Depuis le lot 6, toutes les photos sont servies par nos routes
-- (/api/tickets/<id>/photos/<photo>) : droits vérifiés à l'ouverture,
-- puis lien signé de courte durée créé avec le service role. La
-- policy de lecture de 056 permettait encore à tout admin ou éditeur
-- de lister et lire directement toutes les photos de sa commune, ce
-- qui contournerait la confidentialité des signalements (lot 1).
--
-- La lecture avec la clé utilisateur n'est plus autorisée que pour
-- ses propres fichiers : le navigateur doit pouvoir retirer une photo
-- qu'il vient de déposer (Supabase exige SELECT + DELETE pour
-- `remove`). Super-admin : inchangé.
-- Dépôt (INSERT) et suppression : inchangés (056).
--
-- Idempotente. Retour arrière : supabase/rollback/057_tickets_photos_lecture_serveur_down.sql
-- ═══════════════════════════════════════════════════════════════

drop policy if exists "tickets_photos_read" on storage.objects;
create policy "tickets_photos_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tickets-photos'
    and (
      public.my_role() = 'super_admin'
      or (
        public.my_role() in ('admin', 'editor')
        and (storage.foldername(name))[1] = public.my_commune_id()::text
        and owner = auth.uid()
      )
    )
  );
