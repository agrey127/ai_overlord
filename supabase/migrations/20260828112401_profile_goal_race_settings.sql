create table if not exists public.user_training_preferences (
  user_id text primary key references public.users(user_id) on delete cascade,
  timezone text not null default 'America/Indiana/Indianapolis',
  weekly_run_goal integer not null default 3 check (weekly_run_goal between 0 and 14),
  weekly_strength_goal integer not null default 3 check (weekly_strength_goal between 0 and 14),
  weekly_mileage_goal numeric(6, 2) check (weekly_mileage_goal is null or weekly_mileage_goal between 0 and 500),
  target_weight_lbs numeric(6, 2) check (target_weight_lbs is null or target_weight_lbs between 50 and 1000),
  updated_at timestamptz not null default now()
);

create table if not exists public.running_races (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(user_id) on delete cascade,
  race_name text not null check (char_length(race_name) between 1 and 120),
  race_date date not null,
  distance_miles numeric(7, 2) not null check (distance_miles > 0 and distance_miles <= 1000),
  location text check (location is null or char_length(location) <= 160),
  goal_time_minutes integer check (goal_time_minutes is null or goal_time_minutes between 1 and 100000),
  notes text check (notes is null or char_length(notes) <= 2000),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists running_races_user_date_idx
  on public.running_races (user_id, race_date);

alter table public.user_training_preferences enable row level security;
alter table public.running_races enable row level security;

create policy "Users manage their own training preferences"
  on public.user_training_preferences
  for all
  to authenticated
  using (user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text))
  with check (user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text));

create policy "Users manage their own running races"
  on public.running_races
  for all
  to authenticated
  using (user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text))
  with check (user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text));

revoke all on table public.user_training_preferences from anon;
revoke all on table public.running_races from anon;
grant select, insert, update, delete on table public.user_training_preferences to authenticated;
grant select, insert, update, delete on table public.running_races to authenticated;
