-- Canonical 7-day body-weight trend view for Baseline home card.
--
-- Source of truth:
--   public.v_weight_rolling_7d(user_id, day, weight_lbs, weight_7d_avg)
--
-- We take the latest available rolling 7-day average per user, then use the
-- rolling average from 7 days earlier as the "previous avg (7d)" comparison.

create or replace view public.v_weight_trends_7d as
with ranked as (
  select
    w.user_id,
    w.day,
    w.weight_7d_avg,
    row_number() over (
      partition by w.user_id
      order by w.day desc
    ) as rn
  from public.v_weight_rolling_7d as w
  where w.user_id is not null
    and w.day is not null
    and w.weight_7d_avg is not null
),
latest as (
  select
    user_id,
    day as latest_day,
    weight_7d_avg as weight_avg_7d
  from ranked
  where rn = 1
)
select
  l.user_id,
  l.weight_avg_7d,
  p.weight_7d_avg as prev_weight_avg_7d
from latest as l
left join public.v_weight_rolling_7d as p
  on p.user_id = l.user_id
 and p.day = l.latest_day - 7;
