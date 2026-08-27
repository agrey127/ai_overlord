alter table public.activities
  add column if not exists source text not null default 'manual',
  add column if not exists source_fingerprint text;

create unique index if not exists activities_user_source_fingerprint_idx
  on public.activities (user_id, source_fingerprint)
  where source_fingerprint is not null;

alter table public.activities enable row level security;

drop policy if exists "Users manage own activities" on public.activities;
drop policy if exists "activities_own_all" on public.activities;

create policy "activities_own_all"
  on public.activities for all to authenticated
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

revoke all on table public.activities from anon;
grant select, insert, update, delete on table public.activities to authenticated;
grant usage, select on sequence public.activities_id_seq to authenticated;

create table public.assistant_activity_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  user_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  source_fingerprint text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'duplicate', 'cancelled')),
  activity_id bigint references public.activities(id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index assistant_activity_drafts_user_created_idx
  on public.assistant_activity_drafts (user_id, created_at desc);

grant select, insert, update on table public.assistant_activity_drafts to authenticated;
alter table public.assistant_activity_drafts enable row level security;

create policy "assistant_activity_drafts_own_all"
  on public.assistant_activity_drafts for all to authenticated
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

create or replace function public.confirm_activity_draft(
  p_user_id text,
  p_draft_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft public.assistant_activity_drafts%rowtype;
  saved_activity public.activities%rowtype;
begin
  select *
    into draft
    from public.assistant_activity_drafts
   where id = p_draft_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Activity draft not found.';
  end if;

  if draft.status = 'confirmed' and draft.activity_id is not null then
    select * into saved_activity
      from public.activities
     where id = draft.activity_id
       and user_id = p_user_id;
    return jsonb_build_object('saved', true, 'already_confirmed', true, 'activity', to_jsonb(saved_activity));
  end if;

  if draft.status <> 'pending' then
    raise exception using errcode = '22023', message = 'This activity draft is no longer pending.';
  end if;

  if draft.created_at < now() - interval '24 hours' then
    update public.assistant_activity_drafts
       set status = 'cancelled'
     where id = draft.id;
    raise exception using errcode = '22023', message = 'This activity draft has expired. Please attach the screenshot again.';
  end if;

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
    draft.payload ->> 'activity_type',
    (draft.payload ->> 'activity_date')::date,
    (draft.payload ->> 'duration_minutes')::double precision,
    (draft.payload ->> 'calories_burned')::double precision,
    nullif(draft.payload ->> 'distance_miles', '')::numeric,
    nullif(draft.payload ->> 'average_heart_rate', '')::integer,
    nullif(draft.payload ->> 'cadence', '')::integer,
    nullif(draft.payload ->> 'pace_min_per_mile', '')::numeric,
    nullif(trim(draft.payload ->> 'notes'), ''),
    'garmin_screenshot',
    draft.source_fingerprint
  )
  on conflict (user_id, source_fingerprint) where source_fingerprint is not null
  do nothing
  returning * into saved_activity;

  if saved_activity.id is null then
    select * into saved_activity
      from public.activities
     where user_id = p_user_id
       and source_fingerprint = draft.source_fingerprint;

    update public.assistant_activity_drafts
       set status = 'duplicate',
           activity_id = saved_activity.id,
           confirmed_at = now()
     where id = draft.id;

    return jsonb_build_object('saved', false, 'duplicate', true, 'activity', to_jsonb(saved_activity));
  end if;

  update public.assistant_activity_drafts
     set status = 'confirmed',
         activity_id = saved_activity.id,
         confirmed_at = now()
   where id = draft.id;

  return jsonb_build_object('saved', true, 'duplicate', false, 'activity', to_jsonb(saved_activity));
end;
$$;

revoke all on function public.confirm_activity_draft(text, uuid) from public;
revoke all on function public.confirm_activity_draft(text, uuid) from anon;
grant execute on function public.confirm_activity_draft(text, uuid) to authenticated;
