-- Retour arrière de 046_emargement_tous_membres.sql
-- Les lignes d'émargement « non renseigné » ajoutées restent (present NULL,
-- sans signature) : elles sont invisibles pour l'ancien code. Les statuts
-- « excusé » sont conservés dans la colonne (present = false).
drop trigger if exists trg_session_attendance_statut on public.session_attendance;
drop function if exists public.session_attendance_sync_statut();
drop function if exists public.ensure_session_attendance(uuid);
-- Colonne et contrainte conservées (aucune perte de donnée). Pour les retirer :
-- alter table public.session_attendance drop constraint session_attendance_statut_check, drop column statut;
