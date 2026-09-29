create table public.assistant_delegations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  chief_conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  source_tool_call_id text not null,
  specialist_domain text not null check (specialist_domain in ('running', 'strength', 'nutrition')),
  objective text not null check (length(objective) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  result text check (length(result) <= 8000),
  error text check (length(error) <= 1000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (chief_conversation_id, source_tool_call_id)
);

create index assistant_delegations_owner_created_idx
  on public.assistant_delegations (user_id, created_at desc);

alter table public.assistant_delegations enable row level security;
revoke all on table public.assistant_delegations from anon, authenticated;
grant select, insert on table public.assistant_delegations to authenticated;
grant update (status, result, error, started_at, completed_at)
  on table public.assistant_delegations to authenticated;
grant all on table public.assistant_delegations to service_role;

create policy assistant_delegations_owner_read on public.assistant_delegations
  for select to authenticated
  using ((select auth.uid()) is not null
    and user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text));

create policy assistant_delegations_owner_insert on public.assistant_delegations
  for insert to authenticated
  with check ((select auth.uid()) is not null
    and user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text)
    and exists (
      select 1 from public.assistant_conversations c
      where c.id = assistant_delegations.chief_conversation_id
        and c.user_id = assistant_delegations.user_id and c.domain = 'chief_of_staff'
    ));

create policy assistant_delegations_owner_update on public.assistant_delegations
  for update to authenticated
  using ((select auth.uid()) is not null
    and user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text))
  with check ((select auth.uid()) is not null
    and user_id = coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text)
    and exists (
      select 1 from public.assistant_conversations c
      where c.id = assistant_delegations.chief_conversation_id
        and c.user_id = assistant_delegations.user_id and c.domain = 'chief_of_staff'
    ));
