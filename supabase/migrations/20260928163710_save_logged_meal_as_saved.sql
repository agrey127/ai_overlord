create or replace function public.save_meal_log_as_saved(
  p_user_id text,
  p_meal_log_id integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_meal public.meal_logs%rowtype;
  saved_meal public.saved_meals%rowtype;
  was_already_saved boolean := false;
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'email', auth.uid()::text) <> p_user_id then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select * into source_meal
    from public.meal_logs
   where id = p_meal_log_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'That logged meal was not found.';
  end if;

  if source_meal.saved_meal_id is not null then
    select * into saved_meal
      from public.saved_meals
     where id = source_meal.saved_meal_id
       and user_id = p_user_id;
    was_already_saved := found;
  end if;

  if not was_already_saved then
    insert into public.saved_meals (
      user_id, name, description, calories, protein_g, carbs_g, fat_g,
      saturated_fat_g, fiber_g, soluble_fiber_g, sugar_g, sodium_mg
    ) values (
      p_user_id,
      coalesce(nullif(trim(source_meal.food_name), ''), nullif(trim(source_meal.description), ''), 'Saved meal'),
      source_meal.description,
      source_meal.calories,
      coalesce(source_meal.protein_g, 0),
      coalesce(source_meal.carbs_g, 0),
      coalesce(source_meal.fat_g, 0),
      coalesce(source_meal.saturated_fat_g, 0),
      coalesce(source_meal.fiber_g, 0),
      coalesce(source_meal.soluble_fiber_g, 0),
      coalesce(source_meal.sugar_g, 0),
      coalesce(source_meal.sodium_mg, 0)
    )
    returning * into saved_meal;

    update public.meal_logs
       set saved_meal_id = saved_meal.id
     where id = source_meal.id
       and user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'already_saved', was_already_saved,
    'meal', jsonb_build_object(
      'id', saved_meal.id,
      'name', saved_meal.name,
      'description', saved_meal.description,
      'calories', saved_meal.calories,
      'protein_g', saved_meal.protein_g,
      'carbs_g', saved_meal.carbs_g,
      'fat_g', saved_meal.fat_g
    )
  );
end;
$$;

revoke all on function public.save_meal_log_as_saved(text, integer) from public;
revoke all on function public.save_meal_log_as_saved(text, integer) from anon;
grant execute on function public.save_meal_log_as_saved(text, integer) to authenticated;
