-- ═══════════════════════════════════════════════════════════════
-- Migration 011 — Seed Module Tickets pour Châteauneuf (Vendée)
--
-- 8 tickets représentatifs des problématiques d'une commune
-- vendéenne côtière (~1 164 hab). Coordonnées plausibles autour
-- du centre-bourg (lat: 46.881, lng: -1.978).
--
-- Idempotente : on ne crée le seed que si la commune a < 3 tickets.
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  v_commune_id uuid;
  v_ticket_count integer;
  v_admin_id uuid;
begin
  -- Trouver la commune Châteauneuf (premier match par slug ou nom)
  select id into v_commune_id
    from public.communes
   where slug ilike '%chateauneuf%' or slug ilike '%châteauneuf%'
       or name ilike '%châteauneuf%' or name ilike '%chateauneuf%'
   limit 1;

  if v_commune_id is null then
    raise notice 'Pas de commune Châteauneuf trouvée — seed tickets ignoré.';
    return;
  end if;

  -- Activer le module tickets pour cette commune
  insert into public.commune_modules (commune_id, module_id)
  values (v_commune_id, 'tickets')
  on conflict do nothing;

  -- Vérifier qu'on n'a pas déjà des tickets
  select count(*) into v_ticket_count
    from public.tickets
   where commune_id = v_commune_id;

  if v_ticket_count >= 3 then
    raise notice 'Seed tickets déjà présent (% existants) — skip.', v_ticket_count;
    return;
  end if;

  -- Identifier un admin de la commune (sinon le premier profil rattaché)
  select id into v_admin_id
    from public.profiles
   where commune_id = v_commune_id
   order by case when role = 'admin' then 0 when role = 'editor' then 1 else 2 end
   limit 1;

  -- ─── Insertion des 8 tickets ───
  insert into public.tickets (
    commune_id, created_by, canal, titre, description,
    categorie, priorite, statut,
    adresse, latitude, longitude, precision_geo,
    demandeur_nom, demandeur_telephone, demandeur_email,
    created_at
  ) values

  -- 1. Nid-de-poule rue de la Mairie
  (v_commune_id, v_admin_id, 'elu_terrain',
   'Nid-de-poule rue de la Mairie',
   'Trou d''environ 30 cm de diamètre devant le numéro 12, dangereux pour les vélos. Photo prise lors d''une tournée matinale.',
   'voirie', 'haute', 'assigne',
   '12 rue de la Mairie, Châteauneuf', 46.8810, -1.9782, 'gps',
   null, null, null,
   now() - interval '2 days'),

  -- 2. Lampadaire HS angle rue de l'Église / rue des Lilas
  (v_commune_id, v_admin_id, 'telephone',
   'Lampadaire HS angle rue de l''Église / rue des Lilas',
   'Habitant signale par téléphone que le lampadaire est éteint depuis 3 jours. Zone non éclairée la nuit.',
   'eclairage_public', 'normale', 'pris_en_charge',
   'Angle rue de l''Église et rue des Lilas, Châteauneuf', 46.8821, -1.9774, 'adresse',
   'Mme Bertrand', '02 51 49 12 34', null,
   now() - interval '3 days'),

  -- 3. Branche dangereuse au-dessus du parking
  (v_commune_id, v_admin_id, 'agent_interne',
   'Branche dangereuse au-dessus du parking salle des fêtes',
   'Grosse branche fragilisée par la dernière tempête. Risque de chute sur véhicules. Intervention élagueur à prévoir.',
   'espaces_verts', 'haute', 'en_cours',
   'Parking salle des fêtes, Châteauneuf', 46.8795, -1.9805, 'gps',
   null, null, null,
   now() - interval '5 days'),

  -- 4. Tag sur abribus place du Marché
  (v_commune_id, v_admin_id, 'agent_interne',
   'Tag sur l''abribus place du Marché',
   'Graffiti à nettoyer (tag de couleur noire). Pas urgent mais à programmer.',
   'mobilier_urbain', 'basse', 'nouveau',
   'Place du Marché, Châteauneuf', 46.8814, -1.9789, 'manuelle',
   null, null, null,
   now() - interval '6 hours'),

  -- 5. Fuite d'eau visible chemin du Moulin
  (v_commune_id, v_admin_id, 'telephone',
   'Fuite d''eau visible chemin du Moulin',
   'Geyser d''eau près du compteur public. Signalé par un riverain inquiet pour sa cave. Vendée Eau prévenu, en attente.',
   'reseaux_eau', 'urgente', 'en_attente',
   'Chemin du Moulin, Châteauneuf', 46.8780, -1.9820, 'adresse',
   'M. Lefèvre', '06 12 34 56 78', 'lefevre@example.fr',
   now() - interval '8 hours'),

  -- 6. Banc cassé au square
  (v_commune_id, v_admin_id, 'email',
   'Banc cassé au square',
   'Email reçu d''une habitante avec photo : latte centrale cassée, à remplacer.',
   'mobilier_urbain', 'basse', 'nouveau',
   'Square du centre-bourg, Châteauneuf', 46.8808, -1.9795, 'manuelle',
   'Mme Dupuis', null, 'mc.dupuis@example.fr',
   now() - interval '1 day'),

  -- 7. Panneau STOP arraché entrée du bourg
  (v_commune_id, v_admin_id, 'elu_terrain',
   'Panneau STOP arraché entrée du bourg',
   'Panneau visiblement renversé par un véhicule cette nuit. Carrefour dangereux sans signalisation. À remplacer en priorité.',
   'signalisation', 'urgente', 'assigne',
   'Entrée du bourg, route de la Mer, Châteauneuf', 46.8847, -1.9756, 'gps',
   null, null, null,
   now() - interval '4 hours'),

  -- 8. Bouches d'égout obstruées rue principale
  (v_commune_id, v_admin_id, 'agent_interne',
   'Bouches d''égout obstruées rue principale après orage',
   'Suite à l''orage de la nuit, plusieurs avaloirs sont obstrués par des feuilles et branchages. Eau stagnante par endroits.',
   'voirie', 'haute', 'resolu',
   'Rue principale, Châteauneuf', 46.8812, -1.9785, 'adresse',
   null, null, null,
   now() - interval '8 days')
  ;

  -- Compléter le ticket #8 : assigné, traité et résolu
  update public.tickets
     set assigne_a = v_admin_id,
         pris_en_charge_at = now() - interval '7 days',
         resolu_at = now() - interval '6 days'
   where commune_id = v_commune_id
     and titre = 'Bouches d''égout obstruées rue principale après orage';

  -- Assignation des tickets 1, 2, 3 et 7
  update public.tickets
     set assigne_a = v_admin_id
   where commune_id = v_commune_id
     and titre in (
       'Nid-de-poule rue de la Mairie',
       'Lampadaire HS angle rue de l''Église / rue des Lilas',
       'Branche dangereuse au-dessus du parking salle des fêtes',
       'Panneau STOP arraché entrée du bourg'
     );

  raise notice 'Seed tickets : 8 tickets ajoutés pour la commune %', v_commune_id;
end $$;
