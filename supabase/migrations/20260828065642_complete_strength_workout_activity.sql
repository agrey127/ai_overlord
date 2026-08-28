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
begin
  select *
    into workout
    from public.strength_workout_plans
   where id = p_plan_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Strength workout not found.';
  end if;

  was_already_completed := workout.status = 'completed';

  select count(*)::integer
    into completed_set_count
    from public.strength_sets as strength_set
    join public.strength_plan_exercises as exercise
      on exercise.id = strength_set.plan_exercise_id
   where exercise.plan_id = workout.id
     and strength_set.user_id = p_user_id;

  if not was_already_completed then
    update public.strength_workout_plans
       set status = 'completed',
           completed_at = now(),
           updated_at = now()
     where id = workout.id
       and user_id = p_user_id
     returning * into workout;
  end if;

  workout_fingerprint := 'strength_workout:' || workout.id::text;

  insert into public.activities (
    user_id,
    activity_type,
    activity_date,
    duration_minutes,
    calories_burned,
    distance_miles,
    average_heart_rate,
    cadence,
    pace_min_per_mile,
    notes,
    source,
    source_fingerprint
  ) values (
    p_user_id,
    'strength',
    workout.scheduled_for,
    workout.estimated_minutes::double precision,
    0,
    null,
    null,
    null,
    null,
    workout.name || ' · ' || completed_set_count || ' working sets logged',
    'strength_workout',
    workout_fingerprint
  )
  on conflict (user_id, source_fingerprint) where source_fingerprint is not null
  do nothing
  returning * into saved_activity;

  if saved_activity.id is null then
    select *
      into saved_activity
      from public.activities
     where user_id = p_user_id
       and source_fingerprint = workout_fingerprint;
  end if;

  return jsonb_build_object(
    'completed', true,
    'already_completed', was_already_completed,
    'completed_set_count', completed_set_count,
    'workout_plan_id', workout.id,
    'activity', to_jsonb(saved_activity)
  );
end;
$$;

revoke all on function public.complete_strength_workout(text, uuid) from public;
revoke all on function public.complete_strength_workout(text, uuid) from anon;
grant execute on function public.complete_strength_workout(text, uuid) to authenticated;
