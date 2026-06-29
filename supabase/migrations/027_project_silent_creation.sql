-- ═══════════════════════════════════════════════════════════════
-- Migration 027 — Création silencieuse de projet
-- ═══════════════════════════════════════════════════════════════
--
-- Le nouveau flux veut qu'un projet soit créé instantanément quand
-- l'utilisateur clique « Nouveau projet », pour le rediriger vers
-- la première carte de saisie de la phase Émergence.
--
-- Conséquence : le titre doit pouvoir être absent à la création
-- (placeholder « Sans titre »). On garde un default applicatif.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Le titre redevient simplement un texte avec un default ; il reste
-- not null pour préserver l'invariant en lecture (toujours une string).
alter table public.projects
  alter column titre set default 'Sans titre';

comment on column public.projects.titre is
  'Titre du projet. Default « Sans titre » lors d''une création '
  'silencieuse, à remplir dans le livrable d''identité de la phase '
  'Émergence.';

-- Index utile pour les listings filtrés du nouveau flow
create index if not exists idx_projects_commune_phase_in_ppi
  on public.projects(commune_id, phase, in_ppi);
