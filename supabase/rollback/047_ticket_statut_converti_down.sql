-- Retour arrière de 047_ticket_statut_converti.sql
-- Postgres ne sait pas retirer une valeur d'enum sans recréer le type
-- (et toutes les colonnes, vues et fonctions qui en dépendent).
-- La valeur est donc conservée, inutilisée : appliquer d'abord le
-- retour arrière de 048, qui repasse les signalements convertis en « clos ».
select 1;
