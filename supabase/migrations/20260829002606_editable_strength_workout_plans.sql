create or replace function public.save_strength_workout_plan(
  p_user_id text,
  p_plan_id uuid,
  p_scheduled_for date,
  p_name text,
  p_estimated_minutes integer,
  p_warmups jsonb,
  p_notes text,
  p_exercises jsonb,
  p_confirm_destructive boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  workout public.strength_workout_plans%rowtype;
  exercise jsonb;
  exercise_id uuid;
  exercise_position integer := 0;
  removed_exercise_count integer := 0;
  removed_logged_set_count integer := 0;
  created_workout boolean := false;
begin
  if nullif(trim(p_name), '') is null then
    raise exception using errcode = '22023', message = 'Workout name is required.';
  end if;
  if p_scheduled_for is null then
    raise exception using errcode = '22023', message = 'Workout date is required.';
  end if;
  if p_estimated_minutes not between 1 and 360 then
    raise exception using errcode = '22023', message = 'Estimated minutes must be between 1 and 360.';
  end if;
  if jsonb_typeof(p_warmups) <> 'array'
    or jsonb_array_length(p_warmups) > 10
    or exists (
      select 1 from jsonb_array_elements_text(p_warmups) item
      where char_length(trim(item)) > 160
    ) then
    raise exception using errcode = '22023', message = 'Warm-ups must be an array of at most 10 items, each 160 characters or fewer.';
  end if;
  if jsonb_typeof(p_exercises) <> 'array'
    or jsonb_array_length(p_exercises) < 1
    or jsonb_array_length(p_exercises) > 20 then
    raise exception using errcode = '22023', message = 'A workout must contain between 1 and 20 exercises.';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_exercises) item
     where nullif(item ->> 'id', '') is not null
     group by item ->> 'id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Each existing exercise ID may appear only once.';
  end if;

  if p_plan_id is not null then
    select * into workout
      from public.strength_workout_plans
     where id = p_plan_id and user_id = p_user_id
     for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Workout plan not found.';
    end if;
  end if;

  if workout.id is null then
    insert into public.strength_workout_plans (
      user_id, name, scheduled_for, estimated_minutes, notes, warmups, status
    ) values (
      p_user_id,
      trim(p_name),
      p_scheduled_for,
      p_estimated_minutes,
      nullif(trim(p_notes), ''),
      p_warmups,
      'scheduled'
    ) returning * into workout;
    created_workout := true;
  else
    if exists (
      select 1
        from jsonb_array_elements(p_exercises) item
       where nullif(item ->> 'id', '') is not null
         and not exists (
           select 1 from public.strength_plan_exercises current_exercise
            where current_exercise.id = (item ->> 'id')::uuid
              and current_exercise.plan_id = workout.id
              and current_exercise.user_id = p_user_id
         )
    ) then
      raise exception using errcode = '22023', message = 'One or more exercise IDs do not belong to this workout.';
    end if;

    select count(*)::integer into removed_exercise_count
      from public.strength_plan_exercises current_exercise
     where current_exercise.plan_id = workout.id
       and current_exercise.user_id = p_user_id
       and not exists (
         select 1
           from jsonb_array_elements(p_exercises) item
          where nullif(item ->> 'id', '') is not null
            and (item ->> 'id')::uuid = current_exercise.id
       );

    select count(*)::integer into removed_logged_set_count
      from public.strength_sets logged_set
      join public.strength_plan_exercises current_exercise
        on current_exercise.id = logged_set.plan_exercise_id
     where current_exercise.plan_id = workout.id
       and current_exercise.user_id = p_user_id
       and logged_set.user_id = p_user_id
       and not exists (
         select 1
           from jsonb_array_elements(p_exercises) item
          where nullif(item ->> 'id', '') is not null
            and (item ->> 'id')::uuid = current_exercise.id
       );

    if removed_logged_set_count > 0 and not p_confirm_destructive then
      return jsonb_build_object(
        'updated', false,
        'confirmation_required', true,
        'reason', 'This edit removes exercises that contain logged sets.',
        'plan_id', workout.id,
        'removed_exercise_count', removed_exercise_count,
        'removed_logged_set_count', removed_logged_set_count
      );
    end if;

    update public.strength_workout_plans
       set name = trim(p_name),
           scheduled_for = p_scheduled_for,
           estimated_minutes = p_estimated_minutes,
           notes = nullif(trim(p_notes), ''),
           warmups = p_warmups,
           updated_at = now()
     where id = workout.id and user_id = p_user_id
     returning * into workout;

    update public.strength_plan_exercises
       set position = position + 100
     where plan_id = workout.id and user_id = p_user_id;
  end if;

  for exercise in select value from jsonb_array_elements(p_exercises)
  loop
    exercise_position := exercise_position + 1;
    if nullif(trim(exercise ->> 'exercise_name'), '') is null then
      raise exception using errcode = '22023', message = 'Every exercise requires a name.';
    end if;
    if (exercise ->> 'target_sets')::integer not between 1 and 20
      or (exercise ->> 'target_reps')::integer not between 1 and 100
      or (exercise ->> 'rest_seconds')::integer not between 0 and 1800
      or coalesce(exercise ->> 'training_role', '') not in ('standard', 'heavy', 'volume', 'light', 'technique', 'accessory', 'bodyweight') then
      raise exception using errcode = '22023', message = 'An exercise prescription is invalid.';
    end if;

    exercise_id := nullif(exercise ->> 'id', '')::uuid;
    if exercise_id is null then
      insert into public.strength_plan_exercises (
        plan_id, user_id, exercise_name, position, target_sets, target_reps,
        target_weight_lbs, training_role, rest_seconds, notes
      ) values (
        workout.id,
        p_user_id,
        trim(exercise ->> 'exercise_name'),
        exercise_position,
        (exercise ->> 'target_sets')::integer,
        (exercise ->> 'target_reps')::integer,
        nullif(exercise ->> 'target_weight_lbs', '')::numeric,
        exercise ->> 'training_role',
        (exercise ->> 'rest_seconds')::integer,
        nullif(trim(exercise ->> 'notes'), '')
      );
    else
      update public.strength_plan_exercises
         set exercise_name = trim(exercise ->> 'exercise_name'),
             position = exercise_position,
             target_sets = (exercise ->> 'target_sets')::integer,
             target_reps = (exercise ->> 'target_reps')::integer,
             target_weight_lbs = nullif(exercise ->> 'target_weight_lbs', '')::numeric,
             training_role = exercise ->> 'training_role',
             rest_seconds = (exercise ->> 'rest_seconds')::integer,
             notes = nullif(trim(exercise ->> 'notes'), '')
       where id = exercise_id and plan_id = workout.id and user_id = p_user_id;
    end if;
  end loop;

  delete from public.strength_plan_exercises current_exercise
   where current_exercise.plan_id = workout.id
     and current_exercise.user_id = p_user_id
     and current_exercise.position > 100;

  return jsonb_build_object(
    'updated', true,
    'created', created_workout,
    'confirmation_required', false,
    'plan_id', workout.id,
    'removed_exercise_count', removed_exercise_count,
    'removed_logged_set_count', removed_logged_set_count
  );
end;
$$;

revoke all on function public.save_strength_workout_plan(text, uuid, date, text, integer, jsonb, text, jsonb, boolean)
  from public, anon;
grant execute on function public.save_strength_workout_plan(text, uuid, date, text, integer, jsonb, text, jsonb, boolean)
  to authenticated;
