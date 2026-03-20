import { supabaseClient } from "@/lib/supabase/client";
import type { TodayNutritionHomeRow, CashflowProjection7dRow, WeightTrends7dRow } from "@/lib/contracts/dashboard";

export type LifeSignal = {
  id: string;
  signal_key: string;
  domain: string;
  severity: number;
  score: number;
  title: string;
  message: string;
  facts: string | null;
  recommendation: string | null;
  evidence: unknown;
  detected_at: string | null; // <- fix
};

export type MicroTrendsHomeRow = {
  user_id: string;

  calories_avg_7d: number | null;
  calories_delta_vs_prev_7d: number | null;
  protein_avg_7d: number | null;
  protein_delta_vs_prev_7d: number | null;

  nutrition_days_logged_7d: number | null;

  training_minutes_this_week: number | null;
  training_minutes_delta_vs_last_week: number | null;
  training_days_this_week: number | null;

  sleep_score_avg_7d: number | null;
  sleep_score_delta_vs_prev_7d: number | null;
  min_projected_balance_30d: number | null;
  min_projected_balance_day_30d: string | null;

  net_worth_delta_30d: number | null;
  net_worth_last_snapshot_day: string | null;
};

type WeightRolling7dRow = {
  user_id: string | null;
  day: string | null;
  weight_7d_avg: number | string | null;
};

function toFiniteNumber(value: number | string | null | undefined) {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}


export async function fetchActiveLifeSignals(userId = "agrey127@gmail.com") {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("life_signals")
    .select(
      "id, signal_key, domain, severity, score, title, message, facts, recommendation, evidence, detected_at"
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("score", { ascending: false })
    .order("severity", { ascending: false }) // <- add
    .order("detected_at", { ascending: false })
    .limit(4);

  if (error) {
    console.error("fetchActiveLifeSignals error:", error.message);
    return [];
  }

  return (data ?? []) as LifeSignal[];
}


export async function fetchTodayNutritionHome() {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_today_nutrition_home")
    .select("*")
    .limit(1)
    .maybeSingle<TodayNutritionHomeRow>();

  if (error) throw new Error(`v_today_nutrition_home: ${error.message}`);
  return data;
}

export async function fetchCashflowProjection7d() {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_cashflow_projection_7d")
    .select("*")
    .limit(1)
    .maybeSingle<CashflowProjection7dRow>();

  if (error) throw new Error(`v_cashflow_projection_7d: ${error.message}`);
  return data;
}

export async function fetchWeightTrends7d(userId = "agrey127@gmail.com") {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_weight_trends_7d")
    .select("user_id, weight_avg_7d, prev_weight_avg_7d")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<WeightTrends7dRow>();

  if (error) throw new Error(`v_weight_trends_7d: ${error.message}`);
  if (data && (data.weight_avg_7d != null || data.prev_weight_avg_7d != null)) {
    return data;
  }

  const { data: rollingRows, error: rollingError } = await supabase
    .from("v_weight_rolling_7d")
    .select("user_id, day, weight_7d_avg")
    .eq("user_id", userId)
    .order("day", { ascending: false })
    .limit(14);

  if (rollingError) throw new Error(`v_weight_rolling_7d: ${rollingError.message}`);

  const rows = (rollingRows ?? []) as WeightRolling7dRow[];
  const latest = rows.find((row) => toFiniteNumber(row.weight_7d_avg) != null);
  if (!latest) return data;

  const latestDay = latest.day ? new Date(`${latest.day}T00:00:00`) : null;
  const latestAvg = toFiniteNumber(latest.weight_7d_avg);
  if (!latestDay || latestAvg == null) {
    return {
      user_id: latest.user_id ?? userId,
      weight_avg_7d: latestAvg,
      prev_weight_avg_7d: null,
    };
  }

  const targetTime = latestDay.getTime() - (7 * 24 * 60 * 60 * 1000);
  const prev = rows.find((row) => {
    if (!row.day) return false;
    const avg = toFiniteNumber(row.weight_7d_avg);
    if (avg == null) return false;
    return new Date(`${row.day}T00:00:00`).getTime() <= targetTime;
  });

  return {
    user_id: latest.user_id ?? userId,
    weight_avg_7d: latestAvg,
    prev_weight_avg_7d: prev ? toFiniteNumber(prev.weight_7d_avg) : null,
  };
}


export async function fetchMicroTrendsHome(userId?: string) {
  const supabase = supabaseClient();
  const uid = userId ?? "agrey127@gmail.com";

  const { data, error } = await supabase
    .from("v_micro_trends_home")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle<MicroTrendsHomeRow>();

  if (error) throw error;
  return data; // MicroTrendsHomeRow | null
}
