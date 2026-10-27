-- Additive nullable daily summaries; existing ownership policies and grants remain unchanged.
alter table public.fitness_daily
  add column if not exists sleep_seconds integer,
  add column if not exists sleep_start_at timestamptz,
  add column if not exists sleep_end_at timestamptz,
  add column if not exists sleep_awake_seconds integer,
  add column if not exists sleep_awake_count integer,
  add column if not exists hrv_overnight_ms integer,
  add column if not exists hrv_weekly_ms integer,
  add column if not exists hrv_baseline_low_ms integer,
  add column if not exists hrv_baseline_high_ms integer,
  add column if not exists hrv_status text,
  add column if not exists stress_average integer,
  add column if not exists body_battery_at_wake integer,
  add column if not exists body_battery_high integer,
  add column if not exists body_battery_low integer,
  add column if not exists body_battery_charged integer,
  add column if not exists body_battery_drained integer;
