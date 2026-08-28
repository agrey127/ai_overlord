import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";
import type { ProfileSettings, SettingsResponse } from "@/lib/settings/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const defaultProfile: ProfileSettings = {
  full_name: "",
  timezone: "America/Indiana/Indianapolis",
  bmr_calories: null,
  tdee_calories: null,
  calorie_deficit_goal: null,
  protein_goal_g: null,
  fiber_goal_g: null,
  sodium_goal_mg: null,
  weekly_run_goal: 3,
  weekly_strength_goal: 3,
  weekly_mileage_goal: null,
  target_weight_lbs: null,
  weight_goal_mode: "maintain",
  target_rate_lbs_per_week: null,
};

function optionalNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`Enter a value between ${min} and ${max}.`);
  return number;
}

function requiredInteger(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`Enter a whole number between ${min} and ${max}.`);
  return number;
}

function parseProfile(value: unknown): ProfileSettings {
  const input = (value ?? {}) as Record<string, unknown>;
  const fullName = String(input.full_name ?? "").trim();
  const timezone = String(input.timezone ?? "").trim();
  const mode = String(input.weight_goal_mode ?? "maintain");
  if (fullName.length > 120) throw new Error("Name must be 120 characters or fewer.");
  if (!timezone || timezone.length > 80) throw new Error("Enter a valid timezone.");
  if (!["cut", "maintain", "bulk"].includes(mode)) throw new Error("Choose a valid weight goal.");

  return {
    full_name: fullName,
    timezone,
    bmr_calories: optionalNumber(input.bmr_calories, 500, 10000),
    tdee_calories: optionalNumber(input.tdee_calories, 500, 15000),
    calorie_deficit_goal: optionalNumber(input.calorie_deficit_goal, -5000, 5000),
    protein_goal_g: optionalNumber(input.protein_goal_g, 0, 1000),
    fiber_goal_g: optionalNumber(input.fiber_goal_g, 0, 500),
    sodium_goal_mg: optionalNumber(input.sodium_goal_mg, 0, 50000),
    weekly_run_goal: requiredInteger(input.weekly_run_goal, 0, 14),
    weekly_strength_goal: requiredInteger(input.weekly_strength_goal, 0, 14),
    weekly_mileage_goal: optionalNumber(input.weekly_mileage_goal, 0, 500),
    target_weight_lbs: optionalNumber(input.target_weight_lbs, 50, 1000),
    weight_goal_mode: mode as ProfileSettings["weight_goal_mode"],
    target_rate_lbs_per_week: mode === "maintain" ? null : optionalNumber(input.target_rate_lbs_per_week, 0.1, 10),
  };
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to load settings.";
  return { message, status: message.includes("Authentication") || message.includes("session") ? 401 : 400 };
}

export async function GET(request: Request) {
  try {
    const { supabase, user, userId } = await authenticateRequest(request);
    const [userResult, preferencesResult, weightGoalResult, racesResult] = await Promise.all([
      supabase.from("users").select("full_name, bmr_calories, tdee_calories, calorie_deficit_goal, protein_goal_g, fiber_goal_g, sodium_goal_mg").eq("user_id", userId).maybeSingle(),
      supabase.from("user_training_preferences").select("timezone, weekly_run_goal, weekly_strength_goal, weekly_mileage_goal, target_weight_lbs").eq("user_id", userId).maybeSingle(),
      supabase.from("body_weight_goals").select("mode, target_rate_lbs_per_week").eq("user_id", userId).eq("is_active", true).order("starts_on", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("running_races").select("id, race_name, race_date, distance_miles, location, goal_time_minutes, notes, status").eq("user_id", userId).order("race_date", { ascending: true }),
    ]);
    for (const result of [userResult, preferencesResult, weightGoalResult, racesResult]) {
      if (result.error) throw new Error(result.error.message);
    }
    const users = userResult.data as Partial<ProfileSettings> | null;
    const preferences = preferencesResult.data as Partial<ProfileSettings> | null;
    const weightGoal = weightGoalResult.data as Partial<ProfileSettings> | null;
    return NextResponse.json({
      email: user.email ?? null,
      profile: { ...defaultProfile, ...users, ...preferences, ...weightGoal },
      races: racesResult.data ?? [],
    } satisfies SettingsResponse);
  } catch (error) {
    const { message, status } = statusFor(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const profile = parseProfile((await request.json()).profile);
    const now = new Date().toISOString();
    const userResult = await supabase.from("users").upsert({
      user_id: userId,
      full_name: profile.full_name || null,
      bmr_calories: profile.bmr_calories,
      tdee_calories: profile.tdee_calories,
      calorie_deficit_goal: profile.calorie_deficit_goal,
      protein_goal_g: profile.protein_goal_g,
      fiber_goal_g: profile.fiber_goal_g,
      sodium_goal_mg: profile.sodium_goal_mg,
      updated_at: now,
    }, { onConflict: "user_id" });
    if (userResult.error) throw new Error(userResult.error.message);

    const preferenceResult = await supabase.from("user_training_preferences").upsert({
      user_id: userId,
      timezone: profile.timezone,
      weekly_run_goal: profile.weekly_run_goal,
      weekly_strength_goal: profile.weekly_strength_goal,
      weekly_mileage_goal: profile.weekly_mileage_goal,
      target_weight_lbs: profile.target_weight_lbs,
      updated_at: now,
    }, { onConflict: "user_id" });
    if (preferenceResult.error) throw new Error(preferenceResult.error.message);

    const currentGoal = await supabase.from("body_weight_goals").select("id").eq("user_id", userId).eq("is_active", true).order("starts_on", { ascending: false }).limit(1).maybeSingle();
    if (currentGoal.error) throw new Error(currentGoal.error.message);
    const goalValues = { mode: profile.weight_goal_mode, target_rate_lbs_per_week: profile.target_rate_lbs_per_week, updated_at: now };
    const weightResult = currentGoal.data
      ? await supabase.from("body_weight_goals").update(goalValues).eq("id", currentGoal.data.id).eq("user_id", userId)
      : await supabase.from("body_weight_goals").insert({ ...goalValues, user_id: userId, starts_on: now.slice(0, 10), is_active: true });
    if (weightResult.error) throw new Error(weightResult.error.message);
    return NextResponse.json({ profile });
  } catch (error) {
    const { message, status } = statusFor(error);
    return NextResponse.json({ error: message }, { status });
  }
}
