import { supabaseClient } from "@/lib/supabase/client";

export type SavedMealRow = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  fiber_g: number | null;
  soluble_fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function fetchSavedMealsHome(): Promise<SavedMealRow[]> {
  const supabase = supabaseClient();

  const { data, error } = await supabase
    .from("v_saved_meals_home")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`v_saved_meals_home: ${error.message}`);
  return (data ?? []) as SavedMealRow[];
}
