-- ═══════════════════════════════════════════════════════════════
-- Migration 014 — Purges automatisées via pg_cron
--
-- 1. RPC purge_inactive_push_subscriptions() : supprime les
--    push_subscriptions inutilisées depuis 90+ jours (created_at).
--    Note : on n'a pas de last_seen_at sur la table actuelle.
--    Le proxy created_at suffit en V1 (re-subscribe = nouveau row).
--
-- 2. RPC purge_old_audit_log() : conserve audit_log 365 jours.
--    Modifiable selon politique RGPD interne.
--
-- 3. Activation pg_cron + jobs planifiés :
--    - Tous les jours 03h00 : purge soft-deletes surveys/responses
--      (réutilise purge_old_soft_deletes de migration 009)
--    - Tous les dimanches 04h00 : purge subscriptions inactives
--    - Le 1er du mois 04h30 : purge audit_log > 365j
--
-- Idempotente. Si pg_cron n'est pas activé sur ton projet
-- Supabase (plan gratuit), les CREATE EXTENSION échouent silencieusement
-- via DO block — les RPC restent appelables manuellement.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Purge push_subscriptions inactives ─────────────────────
create or replace function public.purge_inactive_push_subscriptions(
  p_days integer default 90
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  delete from public.push_subscriptions
   where created_at < now() - (p_days || ' days')::interval;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.purge_inactive_push_subscriptions(integer) to service_role;

-- ─── 2. Purge audit_log ancien ─────────────────────────────────
create or replace function public.purge_old_audit_log(
  p_days integer default 365
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  delete from public.audit_log
   where created_at < now() - (p_days || ' days')::interval;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.purge_old_audit_log(integer) to service_role;

-- ─── 3. Activation pg_cron + jobs ─────────────────────────────
-- Tentative d'activation (échoue silencieusement si plan ne le permet pas)
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron non disponible (plan Supabase) — jobs à exécuter manuellement';
  return;
end $$;

-- Job 1 : purge soft-deletes anciens (toutes les nuits 03h00 UTC)
do $$
begin
  perform cron.unschedule('purge_old_soft_deletes_daily');
exception when undefined_function then null;
  when others then null;
end $$;
do $$
begin
  perform cron.schedule(
    'purge_old_soft_deletes_daily',
    '0 3 * * *',
    $cmd$ select public.purge_old_soft_deletes(); $cmd$
  );
exception when undefined_function then null;
  when others then null;
end $$;

-- Job 2 : purge subscriptions inactives (dimanche 04h00 UTC)
do $$
begin
  perform cron.unschedule('purge_inactive_push_subs_weekly');
exception when undefined_function then null;
  when others then null;
end $$;
do $$
begin
  perform cron.schedule(
    'purge_inactive_push_subs_weekly',
    '0 4 * * 0',
    $cmd$ select public.purge_inactive_push_subscriptions(90); $cmd$
  );
exception when undefined_function then null;
  when others then null;
end $$;

-- Job 3 : purge audit_log > 365j (le 1er du mois 04h30 UTC)
do $$
begin
  perform cron.unschedule('purge_old_audit_log_monthly');
exception when undefined_function then null;
  when others then null;
end $$;
do $$
begin
  perform cron.schedule(
    'purge_old_audit_log_monthly',
    '30 4 1 * *',
    $cmd$ select public.purge_old_audit_log(365); $cmd$
  );
exception when undefined_function then null;
  when others then null;
end $$;
