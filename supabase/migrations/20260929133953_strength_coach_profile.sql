create table public.strength_coach_profiles (
  user_id text primary key,
  primary_goal text not null check (primary_goal in ('maintain_strength', 'build_strength', 'build_muscle', 'general_fitness')),
  goal_description text not null check (length(goal_description) between 1 and 500),
  min_sessions_per_week smallint not null check (min_sessions_per_week between 1 and 7),
  max_sessions_per_week smallint not null check (max_sessions_per_week between min_sessions_per_week and 7),
  available_days smallint[] not null default '{}',
  preferred_session_minutes smallint check (preferred_session_minutes between 15 and 240),
  equipment text check (length(equipment) <= 500),
  training_limits text check (length(training_limits) <= 1000),
  updated_at timestamptz not null default now(),
  check (cardinality(available_days) <= 7)
);

create table public.strength_coach_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index strength_coach_drafts_user_created_idx
  on public.strength_coach_drafts (user_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['strength_coach_profiles', 'strength_coach_drafts'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
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

create or replace function public.confirm_strength_coach_draft(
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
  draft public.strength_coach_drafts%rowtype;
  saved public.strength_coach_profiles%rowtype;
begin
  if (select auth.uid()) is null
    or p_user_id is distinct from coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text) then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1 from public.assistant_conversations c
    where c.id = p_conversation_id and c.user_id = p_user_id and c.domain = 'strength'
  ) then
    raise exception 'A Strength conversation is required';
  end if;
  select * into draft from public.strength_coach_drafts
   where id = p_draft_id and user_id = p_user_id and conversation_id = p_conversation_id
   for update;
  if not found then raise exception 'Strength profile draft not found'; end if;
  if draft.status = 'cancelled' then raise exception 'Strength profile draft was cancelled'; end if;
  if draft.status = 'pending' and draft.created_at < now() - interval '7 days' then
    raise exception 'Strength profile draft expired';
  end if;
  if draft.status = 'pending' then
    insert into public.strength_coach_profiles (
      user_id, primary_goal, goal_description, min_sessions_per_week, max_sessions_per_week,
      available_days, preferred_session_minutes, equipment, training_limits, updated_at
    ) values (
      p_user_id, draft.payload ->> 'primary_goal', draft.payload ->> 'goal_description',
      (draft.payload ->> 'min_sessions_per_week')::smallint,
      (draft.payload ->> 'max_sessions_per_week')::smallint,
      array(select jsonb_array_elements_text(draft.payload -> 'available_days')::smallint),
      (draft.payload ->> 'preferred_session_minutes')::smallint,
      draft.payload ->> 'equipment', draft.payload ->> 'training_limits', now()
    ) on conflict (user_id) do update set
      primary_goal = excluded.primary_goal,
      goal_description = excluded.goal_description,
      min_sessions_per_week = excluded.min_sessions_per_week,
      max_sessions_per_week = excluded.max_sessions_per_week,
      available_days = excluded.available_days,
      preferred_session_minutes = excluded.preferred_session_minutes,
      equipment = excluded.equipment,
      training_limits = excluded.training_limits,
      updated_at = now();
    update public.strength_coach_drafts set status = 'confirmed', confirmed_at = now()
     where id = draft.id;
  end if;
  select * into saved from public.strength_coach_profiles where user_id = p_user_id;
  return jsonb_build_object('status', 'confirmed', 'profile', to_jsonb(saved));
end;
$$;

revoke all on function public.confirm_strength_coach_draft(text, uuid, uuid) from public, anon;
grant execute on function public.confirm_strength_coach_draft(text, uuid, uuid) to authenticated;
