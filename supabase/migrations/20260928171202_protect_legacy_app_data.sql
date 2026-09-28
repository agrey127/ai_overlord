-- The dashboard uses the signed-in user's email as user_id (with UUID fallback).
-- Keep the singleton context readable only by its owner: two nutrition views
-- and three meal RPCs still depend on it.
do $$
begin
  if not exists (
    select 1 from public.dashboard_context dc
    join auth.users au on dc.active_user_id = coalesce(au.email, au.id::text)
    where dc.id = 1
  ) then
    raise exception 'Dashboard context does not match a signed-in account';
  end if;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'body_weight_goals', 'body_weight_logs', 'dashboard_context',
    'fitness_daily', 'hardcover_book_progress', 'hardcover_book_queue',
    'hardcover_books', 'hardcover_goals', 'hardcover_statuses',
    'hardcover_sync_state', 'hardcover_user_books', 'jellyfin_items',
    'jellyfin_library_items', 'jellyfin_play_sessions', 'jellyfin_users',
    'life_signals', 'meal_logs', 'profile', 'relationship_commitments',
    'relationship_events', 'relationship_plans', 'saved_meals',
    'signal_definitions', 'strava_tokens', 'strava_user_map', 'users'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
  end loop;
end $$;

-- Authenticated readers retain the existing table grants. The policy limits
-- both reads and writes, including UPDATE's old and new row checks.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'body_weight_goals', 'body_weight_logs', 'fitness_daily',
    'hardcover_book_progress', 'hardcover_book_queue', 'hardcover_goals',
    'hardcover_user_books', 'life_signals', 'meal_logs', 'profile',
    'relationship_commitments', 'relationship_events',
    'relationship_plans', 'saved_meals', 'users'
  ] loop
    execute format(
      'create policy owner_access on public.%I for all to authenticated '
      || 'using ((select auth.uid()) is not null and user_id = '
      || 'coalesce((select auth.jwt() ->> ''email''), (select auth.uid())::text)) '
      || 'with check ((select auth.uid()) is not null and user_id = '
      || 'coalesce((select auth.jwt() ->> ''email''), (select auth.uid())::text))',
      table_name
    );
  end loop;
end $$;

create policy active_owner_read on public.dashboard_context
  for select to authenticated
  using ((select auth.uid()) is not null and active_user_id =
    coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text));

create policy catalog_read on public.hardcover_books
  for select to authenticated using (true);
create policy catalog_read on public.hardcover_statuses
  for select to authenticated using (true);
create policy catalog_read on public.signal_definitions
  for select to authenticated using (true);

-- Import state, Jellyfin records, and Strava credentials are service-only.
-- Their authenticated SELECT grants allow legacy views to remain queryable,
-- while the absence of a policy returns no rows.
revoke insert, update, delete on public.dashboard_context,
  public.hardcover_books, public.hardcover_statuses,
  public.hardcover_sync_state, public.jellyfin_items,
  public.jellyfin_library_items, public.jellyfin_play_sessions,
  public.jellyfin_users, public.signal_definitions,
  public.strava_tokens, public.strava_user_map
  from authenticated;

-- Views otherwise run with their owner's privileges and bypass table RLS.
do $$
declare
  view_name text;
begin
  for view_name in
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('alter view public.%I set (security_invoker = true)', view_name);
    execute format('revoke all on table public.%I from anon', view_name);
    execute format('revoke insert, update, delete on table public.%I from authenticated', view_name);
  end loop;
end $$;

-- Public RPC execution was inherited by the anonymous role. These functions
-- are used after sign-in (or by the service role), including meal logging.
do $$
declare
  function_name text;
begin
  for function_name in
    select p.oid::regprocedure::text from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from public, anon', function_name);
  end loop;
end $$;

-- Assert the data paths actually used by the signed-in dashboard. Any failure
-- aborts this migration rather than leaving a partially restricted app.
select set_config('request.jwt.claims',
    jsonb_build_object('sub', au.id, 'email', au.email,
      'role', 'authenticated')::text, true),
  set_config('request.jwt.claim.sub', au.id::text, true)
from auth.users au
join public.dashboard_context dc
  on dc.active_user_id = coalesce(au.email, au.id::text)
where dc.id = 1;

set local role authenticated;

do $$
declare
  view_name text;
  row_count bigint;
begin
  if (select count(*) from public.dashboard_context) <> 1
    or (select count(*) from public.v_today_nutrition_home) <> 1
    or (select count(*) from public.v_saved_meals_home) = 0
    or (select count(*) from public.v_weight_trends_7d) = 0
    or (select count(*) from public.v_micro_trends_home) = 0
    or (select count(*) from public.meal_logs) = 0
    or (select count(*) from public.fitness_daily) = 0
    or (select count(*) from public.life_signals) = 0
  then
    raise exception 'Signed-in dashboard lost an existing data source';
  end if;

  foreach view_name in array array[
    'v_cashflow_projection_7d', 'v_life_signals_active',
    'v_life_signals_all', 'v_load_recovery_balance',
    'v_long_run_progression', 'v_race_readiness', 'v_readiness_status',
    'v_relationship_status', 'v_run_consistency', 'v_saved_meals_home',
    'v_steps_summary', 'v_today_nutrition_home', 'v_weight_rolling_7d',
    'v_weight_trends_7d', 'v_micro_trends_home'
  ] loop
    execute format('select count(*) from public.%I', view_name) into row_count;
  end loop;
end $$;

reset role;
