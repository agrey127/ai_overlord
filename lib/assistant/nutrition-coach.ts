import type { SupabaseClient } from "@supabase/supabase-js";
import { getSharedCoachingGoals } from "@/lib/assistant/coaching-goals";

export type NutritionCoachProfileInput = {
  deficit_start_date: string;
  maintenance_start_date: string;
  maintenance_end_date: string;
  approx_target_loss_lbs: number | null;
  review_style: "review_logs" | "plan_and_review" | "track_targets";
};

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dates must use YYYY-MM-DD.");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Choose a valid calendar date.");
  }
  return date;
}

export function validateNutritionProfile(input: NutritionCoachProfileInput): NutritionCoachProfileInput {
  const start = parseDate(input.deficit_start_date);
  const maintenance = parseDate(input.maintenance_start_date);
  const end = parseDate(input.maintenance_end_date);
  const days = Math.round((maintenance.getTime() - start.getTime()) / 86_400_000);
  if (days < 1 || days > 365 || end < maintenance) throw new Error("Choose ordered deficit and maintenance dates.");
  if (input.approx_target_loss_lbs !== null && (!Number.isFinite(input.approx_target_loss_lbs)
    || input.approx_target_loss_lbs <= 0 || input.approx_target_loss_lbs > 100)) {
    throw new Error("Approximate weight change must be greater than 0 and at most 100 pounds.");
  }
  if (!["review_logs", "plan_and_review", "track_targets"].includes(input.review_style)) {
    throw new Error("Choose a supported review style.");
  }
  return input;
}

export async function getNutritionCoachContext(supabase: SupabaseClient, userId: string) {
  const goals = await getSharedCoachingGoals(supabase, userId);
  const endDate = goals.local_date;
  const startDate = new Date(`${endDate}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 27);
  const since = startDate.toISOString().slice(0, 10);
  const weightSince = new Date(`${endDate}T00:00:00Z`);
  weightSince.setUTCDate(weightSince.getUTCDate() - 89);
  const [meals, weights] = await Promise.all([
    supabase.from("meal_logs").select("meal_date,calories,protein_g,carbs_g,fat_g")
      .eq("user_id", userId).gte("meal_date", since).lte("meal_date", endDate)
      .order("meal_date", { ascending: true }).limit(1000),
    supabase.from("body_weight_logs").select("measured_at,weight_lbs")
      .eq("user_id", userId).gte("measured_at", weightSince.toISOString())
      .order("measured_at", { ascending: false }).limit(100),
  ]);
  if (meals.error) throw new Error(`Unable to read meal logs: ${meals.error.message}`);
  if (weights.error) throw new Error(`Unable to read weight logs: ${weights.error.message}`);
  const days = new Map<string, { date: string; meal_count: number; calories: number; protein_g: number; carbs_g: number; fat_g: number }>();
  for (const meal of meals.data ?? []) {
    const date = String(meal.meal_date);
    const day = days.get(date) ?? { date, meal_count: 0, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    day.meal_count++;
    for (const field of ["calories", "protein_g", "carbs_g", "fat_g"] as const) {
      day[field] += Number(meal[field] ?? 0);
    }
    days.set(date, day);
  }
  return {
    as_of: new Date().toISOString(), period: { start_date: since, end_date: endDate, calendar_days: 28 },
    profile: goals.nutrition, shared_goals: goals,
    logged_days: [...days.values()], days_with_meal_logs: days.size,
    meal_records_returned: (meals.data ?? []).length, meal_records_truncated: (meals.data ?? []).length === 1000,
    recent_weight_logs: weights.data ?? [], weight_records_truncated: (weights.data ?? []).length === 100,
    data_note: "Meal totals describe logged food only. A day without logs is a data gap, not a zero-intake day. Weight entries are observations, not proof of a trend. Do not infer calorie adherence or rate of loss from sparse records.",
  };
}

export async function prepareNutritionCoachProfile(
  supabase: SupabaseClient, userId: string, conversationId: string, input: NutritionCoachProfileInput,
) {
  const payload = validateNutritionProfile(input);
  const { data, error } = await supabase.from("nutrition_coach_drafts")
    .insert({ user_id: userId, conversation_id: conversationId, payload })
    .select("id").single();
  if (error) throw new Error(`Unable to prepare Nutrition profile: ${error.message}`);
  return { confirmation_required: true, draft_id: data!.id, profile: payload };
}

export async function confirmNutritionCoachProfile(
  supabase: SupabaseClient, userId: string, conversationId: string, draftId: string,
) {
  const { data, error } = await supabase.rpc("confirm_nutrition_coach_draft", {
    p_user_id: userId, p_conversation_id: conversationId, p_draft_id: draftId,
  });
  if (error) throw new Error(`Unable to save Nutrition profile: ${error.message}`);
  return data;
}
