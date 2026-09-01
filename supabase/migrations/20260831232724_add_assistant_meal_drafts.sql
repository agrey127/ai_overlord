create table public.assistant_meal_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  user_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  meal_log_id integer references public.meal_logs(id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index assistant_meal_drafts_user_created_idx
  on public.assistant_meal_drafts (user_id, created_at desc);

create index assistant_meal_drafts_conversation_idx
  on public.assistant_meal_drafts (conversation_id);

grant select, insert, update on table public.assistant_meal_drafts to authenticated;
alter table public.assistant_meal_drafts enable row level security;

create policy "assistant_meal_drafts_own_all"
  on public.assistant_meal_drafts for all to authenticated
  using (
    user_id = coalesce(
      (select auth.jwt()) ->> 'email',
      (select auth.uid())::text
    )
  )
  with check (
    user_id = coalesce(
      (select auth.jwt()) ->> 'email',
      (select auth.uid())::text
    )
  );

create or replace function public.confirm_meal_draft(
  p_user_id text,
  p_draft_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft public.assistant_meal_drafts%rowtype;
  saved_meal public.meal_logs%rowtype;
begin
  if p_user_id is distinct from coalesce(
    (select auth.jwt()) ->> 'email',
    (select auth.uid())::text
  ) then
    raise exception using errcode = '42501', message = 'Meal draft access denied.';
  end if;

  select *
    into draft
    from public.assistant_meal_drafts
   where id = p_draft_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Meal draft not found.';
  end if;

  if draft.status = 'confirmed' and draft.meal_log_id is not null then
    select * into saved_meal
      from public.meal_logs
     where id = draft.meal_log_id
       and user_id = p_user_id;
    return jsonb_build_object(
      'saved', true,
      'already_confirmed', true,
      'meal', to_jsonb(saved_meal)
    );
  end if;

  if draft.status <> 'pending' then
    raise exception using errcode = '22023', message = 'This meal estimate is no longer pending.';
  end if;

  if draft.created_at < now() - interval '24 hours' then
    update public.assistant_meal_drafts
       set status = 'cancelled'
     where id = draft.id;
    raise exception using errcode = '22023', message = 'This meal estimate has expired. Please describe the food again.';
  end if;

  insert into public.meal_logs (
    user_id,
    meal_type,
    meal_date,
    logged_at,
    food_name,
    description,
    serving_size,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    saturated_fat_g,
    fiber_g,
    soluble_fiber_g,
    sugar_g,
    sodium_mg
  ) values (
    p_user_id,
    draft.payload ->> 'meal_type',
    (draft.payload ->> 'meal_date')::date,
    now(),
    draft.payload ->> 'food_name',
    draft.payload ->> 'description',
    draft.payload ->> 'serving_size',
    (draft.payload ->> 'calories')::numeric,
    (draft.payload ->> 'protein_g')::numeric,
    (draft.payload ->> 'carbs_g')::numeric,
    (draft.payload ->> 'fat_g')::numeric,
    coalesce((draft.payload ->> 'saturated_fat_g')::numeric, 0),
    coalesce((draft.payload ->> 'fiber_g')::numeric, 0),
    coalesce((draft.payload ->> 'soluble_fiber_g')::numeric, 0),
    coalesce((draft.payload ->> 'sugar_g')::numeric, 0),
    coalesce((draft.payload ->> 'sodium_mg')::numeric, 0)
  )
  returning * into saved_meal;

  update public.assistant_meal_drafts
     set status = 'confirmed',
         meal_log_id = saved_meal.id,
         confirmed_at = now()
   where id = draft.id;

  return jsonb_build_object(
    'saved', true,
    'already_confirmed', false,
    'meal', to_jsonb(saved_meal)
  );
end;
$$;

revoke all on function public.confirm_meal_draft(text, uuid) from public;
revoke all on function public.confirm_meal_draft(text, uuid) from anon;
grant execute on function public.confirm_meal_draft(text, uuid) to authenticated;
