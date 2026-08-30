create table if not exists public.strength_workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  rotation_position integer not null check (rotation_position between 1 and 50),
  estimated_minutes integer not null default 45 check (estimated_minutes between 1 and 360),
  warmups jsonb not null default '[]'::jsonb check (jsonb_typeof(warmups) = 'array'),
  notes text check (notes is null or char_length(notes) <= 1000),
  active boolean not null default true,
  legacy_source_plan_id uuid references public.strength_workout_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, rotation_position)
);

create table if not exists public.strength_workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.strength_workout_templates(id) on delete cascade,
  user_id text not null references public.users(user_id) on delete cascade,
  exercise_name text not null check (char_length(exercise_name) between 1 and 160),
  position integer not null check (position between 1 and 50),
  target_sets integer not null check (target_sets between 1 and 20),
  target_reps integer not null check (target_reps between 1 and 100),
  target_weight_lbs numeric(7, 2) check (target_weight_lbs is null or target_weight_lbs between 0 and 3000),
  training_role text not null default 'standard'
    check (training_role in ('standard', 'heavy', 'volume', 'light', 'technique', 'accessory', 'bodyweight')),
  rest_seconds integer not null default 120 check (rest_seconds between 0 and 1800),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, position)
);

create table if not exists public.strength_workout_rotation_state (
  user_id text primary key references public.users(user_id) on delete cascade,
  next_template_id uuid references public.strength_workout_templates(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.strength_workout_plans
  add column if not exists template_id uuid references public.strength_workout_templates(id) on delete set null;

-- A rotation can wrap more than once on the same date, so a dated session name is not unique.
alter table public.strength_workout_plans
  drop constraint if exists strength_workout_plans_user_id_scheduled_for_name_key;

create index if not exists strength_workout_templates_user_position_idx
  on public.strength_workout_templates (user_id, rotation_position);
create index if not exists strength_workout_template_exercises_template_position_idx
  on public.strength_workout_template_exercises (template_id, position);
create index if not exists strength_workout_plans_template_idx
  on public.strength_workout_plans (template_id);

alter table public.strength_workout_templates enable row level security;
alter table public.strength_workout_template_exercises enable row level security;
alter table public.strength_workout_rotation_state enable row level security;

create policy "strength_workout_templates_own_all"
  on public.strength_workout_templates for all to authenticated
  using (user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text))
  with check (user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text));

create policy "strength_workout_template_exercises_own_all"
  on public.strength_workout_template_exercises for all to authenticated
  using (user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text))
  with check (user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text));

create policy "strength_workout_rotation_state_own_all"
  on public.strength_workout_rotation_state for all to authenticated
  using (user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text))
  with check (user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text));

revoke all on public.strength_workout_templates from anon;
revoke all on public.strength_workout_template_exercises from anon;
revoke all on public.strength_workout_rotation_state from anon;
grant select, insert, update, delete on public.strength_workout_templates to authenticated;
grant select, insert, update, delete on public.strength_workout_template_exercises to authenticated;
grant select, insert, update, delete on public.strength_workout_rotation_state to authenticated;

-- Seed one reusable rotation template from the latest saved version of each named workout.
-- Day numbers in names determine order when present; otherwise the historical plan order is used.
with latest_named as (
  select distinct on (plan.user_id, lower(trim(plan.name)))
    plan.*,
    substring(lower(plan.name) from 'day[[:space:]]*([0-9]+)')::integer as parsed_day
  from public.strength_workout_plans as plan
  order by plan.user_id, lower(trim(plan.name)), plan.updated_at desc, plan.created_at desc
), eligible_candidates as (
  select latest_named.*
  from latest_named
  where latest_named.parsed_day is not null
     or not exists (
       select 1 from latest_named as numbered
       where numbered.user_id = latest_named.user_id and numbered.parsed_day is not null
     )
), eligible as (
  select distinct on (
    eligible_candidates.user_id,
    coalesce(eligible_candidates.parsed_day::text, lower(trim(eligible_candidates.name)))
  ) eligible_candidates.*
  from eligible_candidates
  order by
    eligible_candidates.user_id,
    coalesce(eligible_candidates.parsed_day::text, lower(trim(eligible_candidates.name))),
    eligible_candidates.updated_at desc,
    eligible_candidates.created_at desc
), ordered as (
  select
    eligible.*,
    row_number() over (
      partition by eligible.user_id
      order by eligible.parsed_day nulls last, eligible.scheduled_for, lower(eligible.name)
    )::integer as position
  from eligible
)
insert into public.strength_workout_templates (
  user_id, name, rotation_position, estimated_minutes, warmups, notes, legacy_source_plan_id
)
select
  user_id,
  name,
  position,
  estimated_minutes,
  coalesce(warmups, '[]'::jsonb),
  notes,
  id
from ordered
on conflict (user_id, rotation_position) do nothing;

update public.strength_workout_plans as plan
   set template_id = template.id
  from public.strength_workout_templates as template
 where plan.user_id = template.user_id
   and lower(trim(plan.name)) = lower(trim(template.name))
   and plan.status = 'in_progress'
   and plan.template_id is null;

insert into public.strength_workout_template_exercises (
  template_id, user_id, exercise_name, position, target_sets, target_reps,
  target_weight_lbs, training_role, rest_seconds, notes
)
select
  template.id,
  template.user_id,
  exercise.exercise_name,
  exercise.position,
  exercise.target_sets,
  exercise.target_reps,
  exercise.target_weight_lbs,
  exercise.training_role,
  exercise.rest_seconds,
  exercise.notes
from public.strength_workout_templates as template
join public.strength_plan_exercises as exercise
  on exercise.plan_id = template.legacy_source_plan_id
where not exists (
  select 1
  from public.strength_workout_template_exercises as existing
  where existing.template_id = template.id
);

with template_users as (
  select distinct user_id from public.strength_workout_templates
), last_completed as (
  select distinct on (plan.user_id)
    plan.user_id,
    template.rotation_position
  from public.strength_workout_plans as plan
  join public.strength_workout_templates as template
    on template.user_id = plan.user_id
   and lower(trim(template.name)) = lower(trim(plan.name))
  where plan.status = 'completed'
  order by plan.user_id, plan.completed_at desc nulls last, plan.scheduled_for desc
), initial_state as (
  select
    template_users.user_id,
    coalesce(
      (
        select candidate.id
        from public.strength_workout_templates as candidate
        where candidate.user_id = template_users.user_id
          and candidate.active
          and candidate.rotation_position > coalesce(last_completed.rotation_position, 0)
        order by candidate.rotation_position
        limit 1
      ),
      (
        select candidate.id
        from public.strength_workout_templates as candidate
        where candidate.user_id = template_users.user_id and candidate.active
        order by candidate.rotation_position
        limit 1
      )
    ) as next_template_id
  from template_users
  left join last_completed on last_completed.user_id = template_users.user_id
)
insert into public.strength_workout_rotation_state (user_id, next_template_id)
select user_id, next_template_id from initial_state
on conflict (user_id) do nothing;

create or replace function public.complete_strength_workout(
  p_user_id text,
  p_plan_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  workout public.strength_workout_plans%rowtype;
  saved_activity public.activities%rowtype;
  completed_set_count integer;
  was_already_completed boolean;
  workout_fingerprint text;
  completed_template_id uuid;
  completed_position integer;
  following_template_id uuid;
begin
  select * into workout
    from public.strength_workout_plans
   where id = p_plan_id and user_id = p_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Strength workout not found.';
  end if;

  was_already_completed := workout.status = 'completed';

  select count(*)::integer into completed_set_count
    from public.strength_sets as strength_set
    join public.strength_plan_exercises as exercise
      on exercise.id = strength_set.plan_exercise_id
   where exercise.plan_id = workout.id
     and strength_set.user_id = p_user_id;

  if not was_already_completed then
    update public.strength_workout_plans
       set status = 'completed', completed_at = now(), updated_at = now()
     where id = workout.id and user_id = p_user_id
     returning * into workout;
  end if;

  workout_fingerprint := 'strength_workout:' || workout.id::text;
  insert into public.activities (
    user_id, activity_type, activity_date, duration_minutes, calories_burned,
    distance_miles, average_heart_rate, cadence, pace_min_per_mile,
    notes, source, source_fingerprint
  ) values (
    p_user_id, 'strength', workout.scheduled_for, workout.estimated_minutes::double precision, 0,
    null, null, null, null,
    workout.name || ' · ' || completed_set_count || ' working sets logged',
    'strength_workout', workout_fingerprint
  )
  on conflict (user_id, source_fingerprint) where source_fingerprint is not null
  do nothing
  returning * into saved_activity;

  if saved_activity.id is null then
    select * into saved_activity
      from public.activities
     where user_id = p_user_id and source_fingerprint = workout_fingerprint;
  end if;

  completed_template_id := workout.template_id;
  if completed_template_id is null then
    select template.id into completed_template_id
      from public.strength_workout_templates as template
     where template.user_id = p_user_id
       and lower(trim(template.name)) = lower(trim(workout.name))
     order by template.rotation_position
     limit 1;
  end if;

  if not was_already_completed and completed_template_id is not null then
    select rotation_position into completed_position
      from public.strength_workout_templates
     where id = completed_template_id and user_id = p_user_id;

    select id into following_template_id
      from public.strength_workout_templates
     where user_id = p_user_id and active and rotation_position > completed_position
     order by rotation_position
     limit 1;

    if following_template_id is null then
      select id into following_template_id
        from public.strength_workout_templates
       where user_id = p_user_id and active
       order by rotation_position
       limit 1;
    end if;

    insert into public.strength_workout_rotation_state (user_id, next_template_id, updated_at)
    values (p_user_id, following_template_id, now())
    on conflict (user_id) do update
      set next_template_id = excluded.next_template_id, updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object(
    'completed', true,
    'already_completed', was_already_completed,
    'completed_set_count', completed_set_count,
    'workout_plan_id', workout.id,
    'completed_template_id', completed_template_id,
    'next_template_id', following_template_id,
    'activity', to_jsonb(saved_activity)
  );
end;
$$;

revoke all on function public.complete_strength_workout(text, uuid) from public, anon;
grant execute on function public.complete_strength_workout(text, uuid) to authenticated;
