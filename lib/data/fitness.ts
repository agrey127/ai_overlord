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
  sleep_avg_3d: number | null;
  sleep_delta_3v30: number | null;
  rhr_avg_3d: number | null;
  rhr_delta_3v30: number | null;
  run_minutes_2d: number | null;
  had_hard_day_2d: boolean | null;
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

  // NEW: strongest long run in last 30 days
  max_long_day_30d: string | null;
  max_long_min_30d: number | null;
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
  miles_30d: number | null;
  avg_weekly_miles_30d: number | null;

  // 7d rollups (kept names for UI compatibility)
  runs_this_week: number | null;
  strength_this_week: number | null;

  // long-run signal used in scoring
  last_long_min: number | null;

  // NEW (optional, but your page tries to display them)
  miles_7d: number | null;
  est_race_minutes: number | null;

  readiness_score: number | null;
  drivers: string[] | null;
};

export type StepsSummaryRow = {
  user_id: string;
  steps_avg_7d: number | null;
  steps_avg_30d: number | null;
};

export type StepsDailyRow = {
  user_id: string;
  day: string;
  steps: number | null;
  source: string | null;
  is_final: boolean | null;
  updated_at: string | null;
};

export async function fetchStepsSummary(userId: string) {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_steps_summary")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (error) throw new Error(`v_steps_summary: ${error.message}`);
  return oneRow<StepsSummaryRow>(data);
}

export async function fetchStepsLast14Days(userId: string, endDay: string, startDay: string) {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("fitness_daily")
    .select("user_id, day, steps, source, is_final, updated_at")
    .eq("user_id", userId)
    .gte("day", startDay)
    .lte("day", endDay)
    .order("day", { ascending: false });

  if (error) throw new Error(`fitness_daily steps: ${error.message}`);
  return (data ?? []) as StepsDailyRow[];
}

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

export type StrengthWeeklySummary = {
  workouts_last_7d: number;
  average_workouts_per_week_8w: number;
  prior_week_volume_lbs: number;
  preceding_week_volume_lbs: number;
  volume_difference_lbs: number;
  volume_difference_percent: number | null;
  prior_week_start: string;
  prior_week_end: string;
};

const FITNESS_TIME_ZONE = process.env.APP_TIME_ZONE ?? "America/Indiana/Indianapolis";

function localDay(value: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FITNESS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function mondayOfWeek(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  return shiftDay(day, -((date.getUTCDay() + 6) % 7));
}

export async function fetchStrengthWeeklySummary(userId: string): Promise<StrengthWeeklySummary> {
  const supabase = supabaseClient();
  const today = localDay(new Date());
  const rollingStart = shiftDay(today, -6);
  const averageStart = shiftDay(today, -55);
  const currentWeekStart = mondayOfWeek(today);
  const priorWeekStart = shiftDay(currentWeekStart, -7);
  const priorWeekEnd = shiftDay(currentWeekStart, -1);
  const precedingWeekStart = shiftDay(currentWeekStart, -14);
  const broadQueryStart = new Date(Date.now() - 65 * 86_400_000).toISOString();
  const volumeQueryStart = `${precedingWeekStart}T00:00:00Z`;
  const volumeQueryEnd = `${currentWeekStart}T12:00:00Z`;

  const [workoutResult, setResult] = await Promise.all([
    supabase
      .from("strength_workout_plans")
      .select("id,completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", broadQueryStart),
    supabase
      .from("strength_sets")
      .select("completed_at,weight_lbs,reps")
      .eq("user_id", userId)
      .gte("completed_at", volumeQueryStart)
      .lt("completed_at", volumeQueryEnd),
  ]);

  if (workoutResult.error) throw new Error(`strength workout history: ${workoutResult.error.message}`);
  if (setResult.error) throw new Error(`strength set history: ${setResult.error.message}`);

  const workoutDays = (workoutResult.data ?? [])
    .map((workout) => workout.completed_at ? localDay(new Date(workout.completed_at)) : null)
    .filter((day): day is string => day !== null);
  const workoutsLast7d = workoutDays.filter((day) => day >= rollingStart && day <= today).length;
  const workoutsLast8w = workoutDays.filter((day) => day >= averageStart && day <= today).length;

  let priorWeekVolume = 0;
  let precedingWeekVolume = 0;
  for (const set of setResult.data ?? []) {
    const day = localDay(new Date(set.completed_at));
    const volume = Number(set.weight_lbs) * Number(set.reps);
    if (!Number.isFinite(volume)) continue;
    if (day >= priorWeekStart && day < currentWeekStart) priorWeekVolume += volume;
    if (day >= precedingWeekStart && day < priorWeekStart) precedingWeekVolume += volume;
  }

  const volumeDifference = priorWeekVolume - precedingWeekVolume;
  return {
    workouts_last_7d: workoutsLast7d,
    average_workouts_per_week_8w: workoutsLast8w / 8,
    prior_week_volume_lbs: priorWeekVolume,
    preceding_week_volume_lbs: precedingWeekVolume,
    volume_difference_lbs: volumeDifference,
    volume_difference_percent: precedingWeekVolume > 0
      ? volumeDifference / precedingWeekVolume * 100
      : null,
    prior_week_start: priorWeekStart,
    prior_week_end: priorWeekEnd,
  };
}
