"use server";

import { revalidatePath } from "next/cache";
import { supabaseClient } from "@/lib/supabase/client";

function requireString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing field: ${key}`);
  }
  return value.trim();
}

function parseOptionalNumber(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number for ${key}`);
  }
  return parsed;
}

export async function updateFoodLogItem(formData: FormData) {
  const rawId = requireString(formData, "id");
  const id = Number(rawId);
  if (!Number.isInteger(id)) {
    throw new Error("Invalid item id");
  }

  const mealType = requireString(formData, "meal_type");
  const foodName = requireString(formData, "food_name");
  const descriptionRaw = formData.get("description");
  const description = typeof descriptionRaw === "string" && descriptionRaw.trim() ? descriptionRaw.trim() : null;

  const calories = parseOptionalNumber(formData, "calories");
  const proteinG = parseOptionalNumber(formData, "protein_g");
  const carbsG = parseOptionalNumber(formData, "carbs_g");
  const fatG = parseOptionalNumber(formData, "fat_g");

  const supabase = supabaseClient();
  const { error } = await supabase
    .from("meal_logs")
    .update({
      meal_type: mealType,
      food_name: foodName,
      description,
      calories,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
    })
    .eq("id", id);

  if (error) throw new Error(`meal_logs update: ${error.message}`);

  revalidatePath("/baseline");
  revalidatePath("/baseline/more");
  revalidatePath("/baseline/more/nutrition");
}

export async function deleteFoodLogItem(formData: FormData) {
  const rawId = requireString(formData, "id");
  const id = Number(rawId);
  if (!Number.isInteger(id)) {
    throw new Error("Invalid item id");
  }

  const supabase = supabaseClient();
  const { error } = await supabase.from("meal_logs").delete().eq("id", id);

  if (error) throw new Error(`meal_logs delete: ${error.message}`);

  revalidatePath("/baseline");
  revalidatePath("/baseline/more");
  revalidatePath("/baseline/more/nutrition");
}
