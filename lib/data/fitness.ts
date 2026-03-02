import { supabaseClient } from "@/lib/supabase/client";

function oneRow<T>(data: T[] | null | undefined) {
  return (data?.[0] ?? null) as T | null;
}

/* -----------------------------
   Readiness (color + freshness)
------------------------------ */
export type ReadinessStatusRow = {
  user_id: string;
  as_of_day: string | null;
  as_of_updated_at: string | null;
  data_age_hours: number | null;

  sleep_score: number | null;
  resting_heart_rate: number | null;
  rhr_avg_30d: number | null;
  rhr_delta: number | null;

  steps: number | null;
  steps_avg_3d: number | null;

  penalty: number | null;
  readiness_color: "green" | "yellow" | "red" | "gray" | string;

  reasons: string[] | null; // text[] comes back as array in supabase-js
};

export async function fetchReadinessStatus(userId: string) {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_readiness_status")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (error) throw new Error(`v_readiness_status: ${error.message}`);
  return oneRow<ReadinessStatusRow>(data);
}

/* -----------------------------
   Run consistency (≤2 day rule)
------------------------------ */
export type RunConsistencyRow = {
  user_id: string;
  last_run_date: string | null;
  days_since_last_run: number | null;
  within_2_day_rule: boolean | null;
  max_gap_last_30d: number | null;
};

export async function fetchRunConsistency(userId: string) {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_run_consistency")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (error) throw new Error(`v_run_consistency: ${error.message}`);
  return oneRow<RunConsistencyRow>(data);
}

/* -----------------------------
   Long run progression
------------------------------ */
export type LongRunProgressionRow = {
  user_id: string;
  last_long_day: string | null;
  last_long_min: number | null;
  prev_long_day: string | null;
  prev_long_min: number | null;
  delta_min: number | null;
  next_target_min: number | null;
  jumped_too_fast: boolean | null;
};

export async function fetchLongRunProgression(userId: string) {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_long_run_progression")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (error) throw new Error(`v_long_run_progression: ${error.message}`);
  return oneRow<LongRunProgressionRow>(data);
}

/* -----------------------------
   Load vs recovery balance
------------------------------ */
export type LoadRecoveryBalanceRow = {
  user_id: string;

  run_minutes_7d: number | null;
  run_minutes_30d: number | null;

  sleep_avg_7d: number | null;
  sleep_avg_30d: number | null;
  sleep_delta_7v30: number | null;

  rhr_avg_7d: number | null;
  rhr_avg_30d: number | null;
  rhr_delta_7v30: number | null;

  overreach_risk: boolean | null;
};

export async function fetchLoadRecoveryBalance(userId: string) {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_load_recovery_balance")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (error) throw new Error(`v_load_recovery_balance: ${error.message}`);
  return oneRow<LoadRecoveryBalanceRow>(data);
}

/* -----------------------------
   Race readiness snapshot
------------------------------ */
export type RaceReadinessRow = {
  user_id: string;

  // daily gate context (still useful)
  readiness_color: string | null;
  readiness_as_of_day: string | null;

  // NEW: race-readiness color scale (green/yellow/orange/red)
  readiness_band: "green" | "yellow" | "orange" | "red" | null;

  // 7d rollups (kept names for UI compatibility)
  runs_this_week: number | null;
  strength_this_week: number | null;

  // long-run signal used in scoring
  last_long_min: number | null;

  // NEW (optional, but your page tries to display them)
  miles_7d: number | null;
  miles_30d: number | null;
  avg_weekly_miles_30d: number | null;
  est_race_minutes: number | null;

  readiness_score: number | null;
  drivers: string[] | null;
};

export async function fetchRaceReadiness(userId: string) {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_race_readiness")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (error) throw new Error(`v_race_readiness: ${error.message}`);
  return oneRow<RaceReadinessRow>(data);
}