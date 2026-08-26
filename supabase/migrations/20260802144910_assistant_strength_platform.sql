create extension if not exists pgcrypto;

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'New conversation',
  domain text not null default 'general'
    check (domain in ('general', 'strength', 'nutrition', 'finance', 'relationships', 'planning')),
  last_response_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  tool_name text,
  tool_call_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.strength_workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  scheduled_for date not null,
  estimated_minutes integer not null default 45 check (estimated_minutes between 1 and 360),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'skipped')),
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scheduled_for, name)
);

create table public.strength_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strength_workout_plans(id) on delete cascade,
  user_id text not null,
  exercise_name text not null,
  position integer not null check (position > 0),
  target_sets integer not null check (target_sets between 1 and 20),
  target_reps integer not null check (target_reps between 1 and 100),
  rest_seconds integer not null default 120 check (rest_seconds between 0 and 1800),
  notes text,
  created_at timestamptz not null default now(),
  unique (plan_id, position)
);

create table public.strength_sets (
  id uuid primary key default gen_random_uuid(),
  plan_exercise_id uuid not null references public.strength_plan_exercises(id) on delete cascade,
  user_id text not null,
  set_number integer not null check (set_number between 1 and 30),
  weight_lbs numeric(7,2) not null check (weight_lbs >= 0 and weight_lbs <= 3000),
  reps integer not null check (reps between 1 and 200),
  rir numeric(3,1) check (rir is null or (rir >= 0 and rir <= 10)),
  notes text,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_exercise_id, set_number)
);

create index assistant_conversations_user_updated_idx
  on public.assistant_conversations (user_id, updated_at desc);
create index assistant_messages_conversation_created_idx
  on public.assistant_messages (conversation_id, created_at);
create index strength_workout_plans_user_day_idx
  on public.strength_workout_plans (user_id, scheduled_for desc);
create index strength_plan_exercises_plan_position_idx
  on public.strength_plan_exercises (plan_id, position);
create index strength_sets_user_completed_idx
  on public.strength_sets (user_id, completed_at desc);

grant select, insert, update, delete on public.assistant_conversations to authenticated;
grant select, insert, update, delete on public.assistant_messages to authenticated;
grant select, insert, update, delete on public.strength_workout_plans to authenticated;
grant select, insert, update, delete on public.strength_plan_exercises to authenticated;
grant select, insert, update, delete on public.strength_sets to authenticated;

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.strength_workout_plans enable row level security;
alter table public.strength_plan_exercises enable row level security;
alter table public.strength_sets enable row level security;

create policy "assistant_conversations_own_all"
  on public.assistant_conversations for all to authenticated
  using (user_id = coalesce(auth.jwt() ->> 'email', (select auth.uid())::text))
  with check (user_id = coalesce(auth.jwt() ->> 'email', (select auth.uid())::text));

create policy "assistant_messages_own_all"
  on public.assistant_messages for all to authenticated
  using (user_id = coalesce(auth.jwt() ->> 'email', (select auth.uid())::text))
  with check (user_id = coalesce(auth.jwt() ->> 'email', (select auth.uid())::text));

create policy "strength_workout_plans_own_all"
  on public.strength_workout_plans for all to authenticated
  using (user_id = coalesce(auth.jwt() ->> 'email', (select auth.uid())::text))
  with check (user_id = coalesce(auth.jwt() ->> 'email', (select auth.uid())::text));

create policy "strength_plan_exercises_own_all"
  on public.strength_plan_exercises for all to authenticated
  using (user_id = coalesce(auth.jwt() ->> 'email', (select auth.uid())::text))
  with check (user_id = coalesce(auth.jwt() ->> 'email', (select auth.uid())::text));

create policy "strength_sets_own_all"
  on public.strength_sets for all to authenticated
  using (user_id = coalesce(auth.jwt() ->> 'email', (select auth.uid())::text))
  with check (user_id = coalesce(auth.jwt() ->> 'email', (select auth.uid())::text));
