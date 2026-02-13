import { supabaseClient } from "@/lib/supabase/client";
import type { TodayNutritionHomeRow, CashflowProjection7dRow } from "@/lib/contracts/dashboard";

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
  evidence: any;
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


export async function fetchMicroTrendsHome(userId?: string) {
  const supabase = supabaseClient();
  const uid = userId ?? "agrey127@gmail.com";

  const { data, error } = await supabase
    .from("v_micro_trends_home")
    .select(
      [
        "user_id",
        "calories_avg_7d",
        "calories_delta_vs_prev_7d",
        "protein_avg_7d",
        "protein_delta_vs_prev_7d",
        "nutrition_days_logged_7d",
        "training_minutes_this_week",
        "training_minutes_delta_vs_last_week",
        "training_days_this_week",
        "sleep_score_avg_7d",
        "sleep_score_delta_vs_prev_7d",
        "min_projected_balance_30d",
        "min_projected_balance_day_30d",
        "net_worth_delta_30d",
        "net_worth_last_snapshot_day",
      ].join(",")
    )
    .eq("user_id", uid)
    .maybeSingle<MicroTrendsHomeRow>();

  if (error) throw error;
  return data; // MicroTrendsHomeRow | null
}
