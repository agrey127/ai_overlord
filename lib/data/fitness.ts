import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function sbAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// Your current single-user setup:
const USER_ID = "agrey127@gmail.com";

async function oneRow<T>(query: PromiseLike<{ data: T[] | null; error: any }>, name: string) {
  const { data, error } = await query;
  if (error) throw new Error(`${name}: ${error.message ?? String(error)}`);
  return (data?.[0] ?? null) as T | null;
}

export type FitnessTodayHome = {
  user_id: string;
  sleep_score: number | null;
  sleep_band: "good" | "ok" | "bad" | "unknown";
  resting_heart_rate: number | null;
  rhr_avg_30d: number | null;
  rhr_delta: number | null;
  rhr_flag: boolean;
  steps: number | null;
  steps_goal: number;
  steps_remaining: number | null;
  training_minutes_today: number;
  distance_today: number;
  strength_sessions_today: number;
  is_hard_day_today: boolean;
};

export async function fetchFitnessTodayHome(userId = USER_ID) {
  const sb = sbAdmin();
  return oneRow<FitnessTodayHome>(
    sb.from("v_fitness_today_home").select("*").eq("user_id", userId).limit(1),
    "fetchFitnessTodayHome"
  );
}

export type FitnessWeekHome = {
  user_id: string;
  week_start: string;
  run_sessions_week: number;
  run_goal_week: number;
  runs_remaining_week: number;
  hard_days_week: number;
  hard_days_budget_week: number;
  hard_days_remaining_week: number;
  strength_sessions_week: number;
  strength_goal_week: number;
  strength_remaining_week: number;
  minutes_week: number;
  distance_week: number;
  last_run_date: string | null;
  days_since_last_run: number | null;
};

export async function fetchFitnessWeekHome(userId = USER_ID) {
  const sb = sbAdmin();
  return oneRow<FitnessWeekHome>(
    sb.from("v_fitness_week_home").select("*").eq("user_id", userId).limit(1),
    "fetchFitnessWeekHome"
  );
}

export type FitnessTrendsHome = {
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

export async function fetchFitnessTrendsHome(userId = USER_ID) {
  const sb = sbAdmin();
  return oneRow<FitnessTrendsHome>(
    sb.from("v_fitness_trends_home").select("*").eq("user_id", userId).limit(1),
    "fetchFitnessTrendsHome"
  );
}