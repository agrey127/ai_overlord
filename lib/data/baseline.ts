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
  detected_at: string;
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
