-- Canonical 7-day body-weight trend view for Baseline home card.
--
-- This view normalizes weight-average column naming from v_micro_trends_home
-- so the app can consume stable fields:
--   - weight_avg_7d
--   - prev_weight_avg_7d

create or replace view public.v_weight_trends_7d as
select
  m.user_id,
  coalesce(
    nullif((to_jsonb(m) ->> 'weight_avg_7d'), '')::numeric,
    nullif((to_jsonb(m) ->> 'avg_weight_7d'), '')::numeric,
    nullif((to_jsonb(m) ->> 'weight_7d_avg'), '')::numeric
  ) as weight_avg_7d,
  coalesce(
    nullif((to_jsonb(m) ->> 'prev_weight_avg_7d'), '')::numeric,
    nullif((to_jsonb(m) ->> 'weight_avg_prev_7d'), '')::numeric,
    nullif((to_jsonb(m) ->> 'previous_weight_avg_7d'), '')::numeric,
    nullif((to_jsonb(m) ->> 'avg_weight_prev_7d'), '')::numeric
  ) as prev_weight_avg_7d
from public.v_micro_trends_home as m;
