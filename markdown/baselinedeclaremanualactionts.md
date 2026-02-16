"use server";

import { supabaseClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function asMealType(v: string) {
  const ok = ["breakfast", "lunch", "dinner", "snack"] as const;
  if ((ok as readonly string[]).includes(v)) return v;
  return "snack";
}

// accepts integers or decimals with up to 2 places; allows ".25"
function parseNum2(label: string, raw: string, opts?: { allowZero?: boolean }) {
  const allowZero = opts?.allowZero ?? false;

  const s = raw.trim();
  if (!s) {
    if (allowZero) return 0;
    throw new Error(`${label} is required`);
  }

  const normalized = s.startsWith(".") ? `0${s}` : s;

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${label} must be a number with up to 2 decimals`);
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) throw new Error(`${label} is invalid`);
  if (!allowZero && n <= 0) throw new Error(`${label} must be > 0`);
  if (allowZero && n < 0) throw new Error(`${label} must be >= 0`);

  return Math.round(n * 100) / 100;
}

export async function submitManualLog(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const mealType = asMealType(String(formData.get("meal_type") ?? "lunch"));

  const calories = parseNum2("Calories", String(formData.get("calories") ?? ""), { allowZero: false });
  const protein = parseNum2("Protein (g)", String(formData.get("protein_g") ?? "0"), { allowZero: true });
  const carbs = parseNum2("Carbs (g)", String(formData.get("carbs_g") ?? "0"), { allowZero: true });
  const fat = parseNum2("Fat (g)", String(formData.get("fat_g") ?? "0"), { allowZero: true });

  const saveAsMeal = String(formData.get("save_as_meal") ?? "") === "on";
  const templateName = String(formData.get("template_name") ?? "").trim();

  if (!description) throw new Error("Description is required");

  const supabase = supabaseClient();

  // 1) Log it
  const { error: logErr } = await supabase.rpc("log_manual_meal", {
    p_description: description,
    p_meal_type: mealType,
    p_calories: calories,
    p_protein_g: protein,
    p_carbs_g: carbs,
    p_fat_g: fat,
  });

  if (logErr) throw new Error(`log_manual_meal: ${logErr.message}`);

  // 2) Optionally save as template
  if (saveAsMeal) {
    const nameToUse = templateName || description;

    const { error: saveErr } = await supabase.rpc("create_saved_meal", {
      p_name: nameToUse,
      p_calories: calories,
      p_description: null,
      p_protein_g: protein,
      p_carbs_g: carbs,
      p_fat_g: fat,
      p_saturated_fat_g: 0,
      p_fiber_g: 0,
      p_soluble_fiber_g: 0,
      p_sugar_g: 0,
      p_sodium_mg: 0,
    });

    if (saveErr) throw new Error(`create_saved_meal: ${saveErr.message}`);
  }
  // Make sure next page shows fresh data
  revalidatePath("/baseline");
  revalidatePath("/baseline/declare");

  // Hard end the request; no client router weirdness
  redirect("/baseline/declare");
}

