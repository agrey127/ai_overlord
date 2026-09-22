"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";
import { requireUserId } from "@/lib/supabase/server";

function requireDay(formData: FormData) {
  const day = String(formData.get("day") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return day;
}

function requireInt(formData: FormData, key: string, label: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) throw new Error(`${label} is required`);
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must be a whole number`);

  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${label} is invalid`);

  return Math.trunc(value);
}

export async function submitManualFitness(formData: FormData) {
  const userId = await requireUserId();

  const day = requireDay(formData);
  const steps = requireInt(formData, "steps", "Steps");
  const restingHeartRate = requireInt(formData, "resting_heart_rate", "Resting heart rate");
  const sleepScore = requireInt(formData, "sleep_score", "Sleep score");

  const supabase = await supabaseClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("fitness_daily").upsert(
    {
      user_id: userId,
      day,
      steps,
      resting_heart_rate: restingHeartRate,
      sleep_score: sleepScore,
      source: "manual_entry",
      captured_at: now,
      source_updated_at: now,
    },
    { onConflict: "user_id,day" }
  );

  if (error) throw new Error(`fitness_daily: ${error.message}`);

  revalidatePath("/baseline");
  revalidatePath("/baseline/fitness");
  revalidatePath("/baseline/more");
  revalidatePath("/baseline/more/manual-fitness");

  redirect("/baseline/fitness");
}
