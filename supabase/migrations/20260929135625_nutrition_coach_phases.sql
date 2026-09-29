create table public.nutrition_coach_profiles (
  user_id text primary key,
  deficit_start_date date not null,
  maintenance_start_date date not null,
  maintenance_end_date date not null,
  approx_target_loss_lbs numeric(6,1) check (approx_target_loss_lbs > 0 and approx_target_loss_lbs <= 100),
  review_style text not null check (review_style in ('review_logs', 'plan_and_review', 'track_targets')),
  updated_at timestamptz not null default now(),
  check (maintenance_start_date > deficit_start_date),
  check (maintenance_start_date <= deficit_start_date + 365),
  check (maintenance_end_date >= maintenance_start_date)
);

create table public.nutrition_coach_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index nutrition_coach_drafts_user_created_idx
  on public.nutrition_coach_drafts (user_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['nutrition_coach_profiles', 'nutrition_coach_drafts'] loop
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

create or replace function public.confirm_nutrition_coach_draft(
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
  draft public.nutrition_coach_drafts%rowtype;
  saved public.nutrition_coach_profiles%rowtype;
begin
  if (select auth.uid()) is null
    or p_user_id is distinct from coalesce((select auth.jwt() ->> 'email'), (select auth.uid())::text) then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1 from public.assistant_conversations c
    where c.id = p_conversation_id and c.user_id = p_user_id and c.domain = 'nutrition'
  ) then
    raise exception 'A Nutrition conversation is required';
  end if;
  select * into draft from public.nutrition_coach_drafts
   where id = p_draft_id and user_id = p_user_id and conversation_id = p_conversation_id
   for update;
  if not found then raise exception 'Nutrition profile draft not found'; end if;
  if draft.status = 'cancelled' then raise exception 'Nutrition profile draft was cancelled'; end if;
  if draft.status = 'pending' and draft.created_at < now() - interval '7 days' then
    raise exception 'Nutrition profile draft expired';
  end if;
  if draft.status = 'pending' then
    insert into public.nutrition_coach_profiles (
      user_id, deficit_start_date, maintenance_start_date, maintenance_end_date,
      approx_target_loss_lbs, review_style, updated_at
    ) values (
      p_user_id, (draft.payload ->> 'deficit_start_date')::date,
      (draft.payload ->> 'maintenance_start_date')::date,
      (draft.payload ->> 'maintenance_end_date')::date,
      (draft.payload ->> 'approx_target_loss_lbs')::numeric,
      draft.payload ->> 'review_style', now()
    ) on conflict (user_id) do update set
      deficit_start_date = excluded.deficit_start_date,
      maintenance_start_date = excluded.maintenance_start_date,
      maintenance_end_date = excluded.maintenance_end_date,
      approx_target_loss_lbs = excluded.approx_target_loss_lbs,
      review_style = excluded.review_style,
      updated_at = now();
    update public.nutrition_coach_drafts set status = 'confirmed', confirmed_at = now()
     where id = draft.id;
  end if;
  select * into saved from public.nutrition_coach_profiles where user_id = p_user_id;
  return jsonb_build_object('status', 'confirmed', 'profile', to_jsonb(saved));
end;
$$;

revoke all on function public.confirm_nutrition_coach_draft(text, uuid, uuid) from public, anon;
grant execute on function public.confirm_nutrition_coach_draft(text, uuid, uuid) to authenticated;
