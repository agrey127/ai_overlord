-- The Running coach uses the same signed-in email/UUID identity as activities.
create table public.running_coach_profiles (
  user_id text primary key,
  goal_type text not null check (goal_type in ('race', 'speed', 'consistency', 'general_fitness', 'return_to_running')),
  goal_description text not null check (length(goal_description) between 1 and 500),
  target_date date,
  target_distance_miles numeric(7,2) check (target_distance_miles > 0 and target_distance_miles <= 200),
  target_time_minutes numeric(8,2) check (target_time_minutes > 0 and target_time_minutes <= 10000),
  available_days smallint[] not null default '{}',
  long_run_day smallint check (long_run_day between 1 and 7),
  max_runs_per_week smallint check (max_runs_per_week between 1 and 7),
  weekly_mileage_target numeric(7,2) check (weekly_mileage_target > 0 and weekly_mileage_target <= 300),
  training_limits text check (length(training_limits) <= 1000),
  updated_at timestamptz not null default now(),
  check (cardinality(available_days) <= 7)
);

create table public.running_training_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  focus text not null check (length(focus) between 1 and 200),
  rationale text not null check (length(rationale) between 1 and 2000),
  sessions jsonb not null check (jsonb_typeof(sessions) = 'array' and jsonb_array_length(sessions) between 1 and 7),
  planned_miles numeric(7,2) not null check (planned_miles >= 0 and planned_miles <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.running_coach_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  kind text not null check (kind in ('profile', 'week_plan')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index running_coach_drafts_user_created_idx
  on public.running_coach_drafts (user_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['running_coach_profiles', 'running_training_weeks', 'running_coach_drafts'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
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

create or replace function public.confirm_running_coach_draft(
  p_user_id text,
  p_conversation_id uuid,
  p_draft_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft public.running_coach_drafts%rowtype;
  saved_profile public.running_coach_profiles%rowtype;
  saved_week public.running_training_weeks%rowtype;
begin
  if (select auth.uid()) is null
    or p_user_id <> coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text)
  then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.assistant_conversations
    where id = p_conversation_id and user_id = p_user_id and domain = 'running'
  ) then
    raise exception using errcode = '42501', message = 'A Running conversation is required.';
  end if;

  select * into draft from public.running_coach_drafts
    where id = p_draft_id and user_id = p_user_id
      and conversation_id = p_conversation_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Running coach draft not found.';
  end if;
  if draft.status = 'confirmed' then
    return jsonb_build_object('saved', true, 'already_confirmed', true, 'kind', draft.kind);
  end if;
  if draft.status <> 'pending' or draft.created_at < now() - interval '48 hours' then
    raise exception using errcode = '22023', message = 'This running coach draft expired.';
  end if;

  if draft.kind = 'profile' then
    insert into public.running_coach_profiles (
      user_id, goal_type, goal_description, target_date, target_distance_miles,
      target_time_minutes, available_days, long_run_day, max_runs_per_week,
      weekly_mileage_target, training_limits
    ) values (
      p_user_id,
      draft.payload ->> 'goal_type',
      draft.payload ->> 'goal_description',
      (draft.payload ->> 'target_date')::date,
      (draft.payload ->> 'target_distance_miles')::numeric,
      (draft.payload ->> 'target_time_minutes')::numeric,
      array(select value::smallint from jsonb_array_elements_text(draft.payload -> 'available_days') value),
      (draft.payload ->> 'long_run_day')::smallint,
      (draft.payload ->> 'max_runs_per_week')::smallint,
      (draft.payload ->> 'weekly_mileage_target')::numeric,
      draft.payload ->> 'training_limits'
    )
    on conflict (user_id) do update set
      goal_type = excluded.goal_type,
      goal_description = excluded.goal_description,
      target_date = excluded.target_date,
      target_distance_miles = excluded.target_distance_miles,
      target_time_minutes = excluded.target_time_minutes,
      available_days = excluded.available_days,
      long_run_day = excluded.long_run_day,
      max_runs_per_week = excluded.max_runs_per_week,
      weekly_mileage_target = excluded.weekly_mileage_target,
      training_limits = excluded.training_limits,
      updated_at = now()
    returning * into saved_profile;
  else
    insert into public.running_training_weeks (
      user_id, week_start, focus, rationale, sessions, planned_miles
    ) values (
      p_user_id,
      (draft.payload ->> 'week_start')::date,
      draft.payload ->> 'focus',
      draft.payload ->> 'rationale',
      draft.payload -> 'sessions',
      (draft.payload ->> 'planned_miles')::numeric
    )
    on conflict (user_id, week_start) do update set
      focus = excluded.focus,
      rationale = excluded.rationale,
      sessions = excluded.sessions,
      planned_miles = excluded.planned_miles,
      updated_at = now()
    returning * into saved_week;
  end if;

  update public.running_coach_drafts
    set status = 'confirmed', confirmed_at = now()
    where id = draft.id;

  if draft.kind = 'profile' then
    return jsonb_build_object('saved', true, 'kind', draft.kind, 'profile', to_jsonb(saved_profile));
  end if;
  return jsonb_build_object('saved', true, 'kind', draft.kind, 'week_plan', to_jsonb(saved_week));
end;
$$;

revoke all on function public.confirm_running_coach_draft(text, uuid, uuid) from public, anon;
grant execute on function public.confirm_running_coach_draft(text, uuid, uuid) to authenticated;

-- A run is valid when distance and duration are known, even if the watch did
-- not report calories. Existing import RPC already inserts NULL from JSON.
alter table public.activities alter column calories_burned drop not null;

-- Verify the current app's signed-in read paths in the same transaction.
select set_config('request.jwt.claims',
    jsonb_build_object('sub', au.id, 'email', au.email, 'role', 'authenticated')::text, true),
  set_config('request.jwt.claim.sub', au.id::text, true)
from auth.users au
join public.dashboard_context dc
  on dc.active_user_id = coalesce(au.email, au.id::text)
where dc.id = 1;

set local role authenticated;

do $$
begin
  perform 1 from public.running_coach_profiles limit 1;
  perform 1 from public.running_training_weeks limit 1;
  perform 1 from public.running_coach_drafts limit 1;
  if (select count(*) from public.v_today_nutrition_home) <> 1
    or (select count(*) from public.v_weight_trends_7d) = 0
    or (select count(*) from public.activities where activity_type = 'run') = 0
  then
    raise exception 'Signed-in dashboard or run history lost access';
  end if;
end $$;

reset role;
