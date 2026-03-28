import { supabaseClient } from "@/lib/supabase/client";

type MealLogRow = {
  id: number;
  meal_date: string;
  meal_type: string;
  description: string | null;
  food_name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string | null;
};

export type TodayFoodItem = {
  id: number;
  mealType: string;
  itemName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  loggedAt: string | null;
};

function toNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return value;
}

export async function fetchTodayFoodLog() {
  const supabase = supabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("meal_logs")
    .select("id, meal_date, meal_type, description, food_name, calories, protein_g, carbs_g, fat_g, logged_at")
    .eq("meal_date", today)
    .order("logged_at", { ascending: false })
    .returns<MealLogRow[]>();

  if (error) throw new Error(`meal_logs: ${error.message}`);

  const items: TodayFoodItem[] = (data ?? []).map((row) => ({
    id: row.id,
    mealType: row.meal_type,
    itemName: row.food_name ?? row.description ?? "Unnamed item",
    calories: toNumber(row.calories),
    proteinG: toNumber(row.protein_g),
    carbsG: toNumber(row.carbs_g),
    fatG: toNumber(row.fat_g),
    loggedAt: row.logged_at,
  }));

  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      proteinG: acc.proteinG + item.proteinG,
      carbsG: acc.carbsG + item.carbsG,
      fatG: acc.fatG + item.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  return { date: today, items, totals };
}
