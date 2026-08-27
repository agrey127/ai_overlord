create index assistant_activity_drafts_conversation_idx
  on public.assistant_activity_drafts (conversation_id);

create index assistant_activity_drafts_activity_idx
  on public.assistant_activity_drafts (activity_id)
  where activity_id is not null;

alter view public.v_monthly_activities set (security_invoker = true);
alter view public.v_weekly_activities set (security_invoker = true);
alter view public.v_weekly_activities_by_type set (security_invoker = true);
alter view public.v_weekly_activities_deltas set (security_invoker = true);

revoke all on table public.v_monthly_activities from anon;
revoke all on table public.v_weekly_activities from anon;
revoke all on table public.v_weekly_activities_by_type from anon;
revoke all on table public.v_weekly_activities_deltas from anon;

grant select on table public.v_monthly_activities to authenticated;
grant select on table public.v_weekly_activities to authenticated;
grant select on table public.v_weekly_activities_by_type to authenticated;
grant select on table public.v_weekly_activities_deltas to authenticated;
