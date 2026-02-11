"use server";

import { supabaseClient } from "@/lib/supabase/client";

function asMealType(v: string) {
  const ok = ["breakfast", "lunch", "dinner", "snack"] as const;
  if ((ok as readonly string[]).includes(v)) return v;
  return "snack";
}

export async function logSavedMeal(formData: FormData) {
  const savedMealId = String(formData.get("saved_meal_id") ?? "").trim();
  const mealType = asMealType(String(formData.get("meal_type") ?? "snack"));
  const multiplier = Number(formData.get("multiplier") ?? 1);

  if (!savedMealId) throw new Error("Missing saved_meal_id");
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error("Invalid multiplier");

  const supabase = supabaseClient();

  const { data, error } = await supabase.rpc("log_saved_meal", {
    p_saved_meal_id: savedMealId,
    p_meal_type: mealType,
    p_multiplier: multiplier,
  });

  if (error) throw new Error(`log_saved_meal: ${error.message}`);

  // returns bigint (e.g., 1110)
  return data;
}
