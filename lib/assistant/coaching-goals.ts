import type { SupabaseClient } from "@supabase/supabase-js";

// Share only structured goals. Free-text notes, health limits, and chat transcripts
// remain in the specialist that collected them.
export async function getSharedCoachingGoals(supabase: SupabaseClient, userId: string) {
  const [running, strength, nutrition] = await Promise.all([
    supabase.from("running_coach_profiles")
      .select("goal_type,target_date,target_distance_miles,target_time_minutes,max_runs_per_week,long_run_day,updated_at")
      .eq("user_id", userId).maybeSingle(),
    supabase.from("strength_coach_profiles")
      .select("primary_goal,min_sessions_per_week,max_sessions_per_week,updated_at")
      .eq("user_id", userId).maybeSingle(),
    supabase.from("nutrition_coach_profiles")
      .select("deficit_start_date,maintenance_start_date,maintenance_end_date,approx_target_loss_lbs,review_style,updated_at")
      .eq("user_id", userId).maybeSingle(),
  ]);
  if (running.error) throw new Error(`Unable to read shared running goal: ${running.error.message}`);
  if (strength.error) throw new Error(`Unable to read shared strength goal: ${strength.error.message}`);
  if (nutrition.error) throw new Error(`Unable to read shared nutrition goal: ${nutrition.error.message}`);
  const timeZone = process.env.APP_TIME_ZONE ?? "America/Indiana/Indianapolis";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const nutritionPhase = nutrition.data
    ? localDate < nutrition.data.deficit_start_date ? "upcoming_deficit"
      : localDate < nutrition.data.maintenance_start_date ? "deficit"
        : localDate <= nutrition.data.maintenance_end_date ? "maintenance" : "plan_ended"
    : null;
  return {
    as_of: new Date().toISOString(),
    local_date: localDate,
    running: running.data,
    strength: strength.data,
    nutrition: nutrition.data ? { ...nutrition.data, current_phase: nutritionPhase } : null,
    source: "Saved, user-owned coaching profiles only",
    note: "A missing goal is unknown, not a decision to skip that area. Free-text limits and specialist conversations are not shared.",
  };
}
