create or replace function public.return_strength_workout_to_scheduled(
  p_user_id text,
  p_plan_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status text;
  logged_set_count integer;
begin
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

  if current_status = 'scheduled' then
    return jsonb_build_object(
      'updated', false,
      'reason', 'Workout is already scheduled.',
      'current_status', current_status,
      'preserved_logged_sets', logged_set_count
    );
  end if;

  if current_status <> 'in_progress' then
    return jsonb_build_object(
      'updated', false,
      'reason', 'Only an in-progress workout can be returned to scheduled.',
      'current_status', current_status,
      'preserved_logged_sets', logged_set_count
    );
  end if;

  update public.strength_workout_plans
     set status = 'scheduled',
         started_at = null,
         completed_at = null,
         updated_at = now()
   where id = p_plan_id
     and user_id = p_user_id;

  return jsonb_build_object(
    'updated', true,
    'previous_status', current_status,
    'current_status', 'scheduled',
    'preserved_logged_sets', logged_set_count
  );
end;
$$;

revoke all on function public.return_strength_workout_to_scheduled(text, uuid)
  from public, anon;
grant execute on function public.return_strength_workout_to_scheduled(text, uuid)
  to authenticated;
