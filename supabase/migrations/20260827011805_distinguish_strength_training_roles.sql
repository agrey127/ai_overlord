alter table public.strength_plan_exercises
  add column training_role text not null default 'standard'
  check (training_role in ('standard', 'heavy', 'volume', 'light', 'technique', 'accessory', 'bodyweight'));

create index strength_plan_exercises_user_name_role_idx
  on public.strength_plan_exercises (user_id, exercise_name, training_role);

update public.strength_plan_exercises as exercise
   set training_role = case exercise.exercise_name
     when 'Sumo deadlift' then 'heavy'
     when 'Barbell row' then 'heavy'
     when 'One-arm dumbbell row' then 'accessory'
     when 'Romanian deadlift' then 'technique'
     when 'Plank' then 'bodyweight'
     else exercise.training_role
   end
  from public.strength_workout_plans as plan
 where plan.id = exercise.plan_id
   and plan.name = 'Day 2 — Heavy Sumo Deadlift + Back'
   and exercise.exercise_name in (
     'Sumo deadlift',
     'Barbell row',
     'One-arm dumbbell row',
     'Romanian deadlift',
     'Plank'
   );

create or replace function public.replace_today_strength_workout(
  p_user_id text,
  p_plan_id uuid,
  p_name text,
  p_estimated_minutes integer,
  p_exercises jsonb,
  p_confirm_destructive boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status text;
  logged_set_count integer;
  exercise jsonb;
  exercise_position integer := 0;
  exercise_role text;
begin
  if nullif(trim(p_name), '') is null then
    raise exception using errcode = '22023', message = 'Workout name is required.';
  end if;
  if p_estimated_minutes not between 1 and 360 then
    raise exception using errcode = '22023', message = 'Estimated minutes must be between 1 and 360.';
  end if;
  if jsonb_typeof(p_exercises) <> 'array'
    or jsonb_array_length(p_exercises) < 1
    or jsonb_array_length(p_exercises) > 20 then
    raise exception using errcode = '22023', message = 'A workout must contain between 1 and 20 exercises.';
  end if;

  select status
    into current_status
    from public.strength_workout_plans
   where id = p_plan_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Workout not found.';
  end if;

  select count(*)::integer
    into logged_set_count
    from public.strength_sets sets
    join public.strength_plan_exercises exercises
      on exercises.id = sets.plan_exercise_id
   where exercises.plan_id = p_plan_id
     and exercises.user_id = p_user_id
     and sets.user_id = p_user_id;

  if (current_status <> 'scheduled' or logged_set_count > 0)
    and not p_confirm_destructive then
    return jsonb_build_object(
      'updated', false,
      'confirmation_required', true,
      'reason', 'The current workout has started, completed, or contains logged sets.',
      'current_status', current_status,
      'logged_set_count', logged_set_count
    );
  end if;

  update public.strength_workout_plans
     set name = trim(p_name),
         estimated_minutes = p_estimated_minutes,
         status = 'scheduled',
         started_at = null,
         completed_at = null,
         updated_at = now()
   where id = p_plan_id
     and user_id = p_user_id;

  delete from public.strength_plan_exercises
   where plan_id = p_plan_id
     and user_id = p_user_id;

  for exercise in select value from jsonb_array_elements(p_exercises)
  loop
    if nullif(trim(exercise ->> 'exercise_name'), '') is null then
      raise exception using errcode = '22023', message = 'Every exercise requires a name.';
    end if;
    exercise_role := coalesce(nullif(trim(exercise ->> 'training_role'), ''), 'standard');
    if exercise_role not in ('standard', 'heavy', 'volume', 'light', 'technique', 'accessory', 'bodyweight') then
      raise exception using errcode = '22023', message = 'Every exercise requires a supported training role.';
    end if;

    exercise_position := exercise_position + 1;
    insert into public.strength_plan_exercises (
      plan_id,
      user_id,
      exercise_name,
      position,
      target_sets,
      target_reps,
      target_weight_lbs,
      training_role,
      rest_seconds,
      notes
    ) values (
      p_plan_id,
      p_user_id,
      trim(exercise ->> 'exercise_name'),
      exercise_position,
      (exercise ->> 'target_sets')::integer,
      (exercise ->> 'target_reps')::integer,
      nullif(exercise ->> 'target_weight_lbs', '')::numeric,
      exercise_role,
      coalesce((exercise ->> 'rest_seconds')::integer, 120),
      nullif(trim(exercise ->> 'notes'), '')
    );
  end loop;

  return jsonb_build_object(
    'updated', true,
    'confirmation_required', false,
    'plan_id', p_plan_id,
    'previous_status', current_status,
    'removed_logged_sets', logged_set_count
  );
end;
$$;
