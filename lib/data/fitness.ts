import { supabaseClient } from "@/lib/supabase/client";

function oneRow<T>(data: T[] | null | undefined) {
  return (data?.[0] ?? null) as T | null;
}

export type FitnessTodayHomeRow = {
  user_id: string;
  sleep_score: number | null;
  sleep_band: string;
  resting_heart_rate: number | null;
  rhr_avg_30d: number | null;
  rhr_delta: number | null;
  rhr_flag: boolean | null;
  steps: number | null;
  steps_goal: number | null;
  steps_remaining: number | null;
  training_minutes_today: number | null;
  distance_today: number | null;
  strength_sessions_today: number | null;
  is_hard_day_today: boolean | null;
};

export async function fetchFitnessTodayHome(userId: string) {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_fitness_today_home")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (error) throw new Error(`v_fitness_today_home: ${error.message}`);
  return oneRow<FitnessTodayHomeRow>(data);
}

export type FitnessWeekHomeRow = {
  user_id: string;
  week_start: string | null;
  run_sessions_week: number | null;
  run_goal_week: number | null;
  runs_remaining_week: number | null;
  hard_days_week: number | null;
  hard_days_budget_week: number | null;
  hard_days_remaining_week: number | null;
  strength_sessions_week: number | null;
  strength_goal_week: number | null;
  strength_remaining_week: number | null;
  minutes_week: number | null;
  distance_week: number | null;
  last_run_date: string | null;
  days_since_last_run: number | null;
};

export async function fetchFitnessWeekHome(userId: string) {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_fitness_week_home")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (error) throw new Error(`v_fitness_week_home: ${error.message}`);
  return oneRow<FitnessWeekHomeRow>(data);
}

export type FitnessTrendsHomeRow = {
  user_id: string;
  sleep_avg_7d: number | null;
  sleep_avg_30d: number | null;
  sleep_delta_7v30: number | null;
  rhr_avg_7d: number | null;
  rhr_avg_30d: number | null;
  rhr_delta_7v30: number | null;
  steps_avg_7d: number | null;
  steps_avg_30d: number | null;
  steps_delta_7v30: number | null;
  minutes_7d: number | null;
  minutes_30d: number | null;
  distance_7d: number | null;
  distance_30d: number | null;
};

export async function fetchFitnessTrendsHome(userId: string) {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_fitness_trends_home")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (error) throw new Error(`v_fitness_trends_home: ${error.message}`);
  return oneRow<FitnessTrendsHomeRow>(data);
}