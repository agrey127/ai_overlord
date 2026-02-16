"use server";

import { supabaseClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const okMealTypes = ["breakfast","lunch","dinner","snack"] as const;
type MealType = (typeof okMealTypes)[number];

function asMealType(v: string): MealType {
  return (okMealTypes as readonly string[]).includes(v) ? (v as MealType) : "snack";
}

export async function proposeAiMeal(input: {
  text?: string;
  imageDataUrl?: string; // data:image/...;base64,...
  meal_type?: string;
  meal_date?: string; // YYYY-MM-DD
}) {
  const supabase = supabaseClient();

  const { data, error } = await supabase.functions.invoke("ai_meal_propose", {
    body: {
      user_id: "agrey127@gmail.com",
      meal_type: asMealType(input.meal_type ?? "snack"),
      meal_date: input.meal_date ?? null,
      text: input.text ?? "",
      image_data_url: input.imageDataUrl ?? "",
    },
  });

  if (error) throw new Error(`ai_meal_propose: ${error.message}`);
  if (!data?.proposal) throw new Error("ai_meal_propose: missing proposal");

  return data.proposal;
}

export async function confirmAiMealLog(payload: {
  description: string;
  meal_type: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g?: number;
  fiber_g?: number;
  soluble_fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
}) {
  const supabase = supabaseClient();

  // Only totals get logged (your requirement)
  const { error: logErr } = await supabase.rpc("log_manual_meal", {
    p_description: payload.description,
    p_meal_type: asMealType(payload.meal_type),
    p_calories: payload.calories,
    p_protein_g: payload.protein_g ?? 0,
    p_carbs_g: payload.carbs_g ?? 0,
    p_fat_g: payload.fat_g ?? 0,
  });

  if (logErr) throw new Error(`log_manual_meal: ${logErr.message}`);

  revalidatePath("/baseline");
  revalidatePath("/baseline/declare");
  redirect("/baseline/declare");
}

export async function saveAiMealTemplate(payload: {
  name?: string;
  description?: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g?: number;
  fiber_g?: number;
  soluble_fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
}) {
  const supabase = supabaseClient();

  const nameToUse = (payload.name ?? "").trim() || "Saved meal";

  const { error: saveErr } = await supabase.rpc("create_saved_meal", {
    p_name: nameToUse,
    p_calories: payload.calories,
    p_description: payload.description ?? null,
    p_protein_g: payload.protein_g ?? 0,
    p_carbs_g: payload.carbs_g ?? 0,
    p_fat_g: payload.fat_g ?? 0,
    p_saturated_fat_g: payload.saturated_fat_g ?? 0,
    p_fiber_g: payload.fiber_g ?? 0,
    p_soluble_fiber_g: payload.soluble_fiber_g ?? 0,
    p_sugar_g: payload.sugar_g ?? 0,
    p_sodium_mg: payload.sodium_mg ?? 0,
  });

  if (saveErr) throw new Error(`create_saved_meal: ${saveErr.message}`);

  revalidatePath("/baseline/declare");
}
