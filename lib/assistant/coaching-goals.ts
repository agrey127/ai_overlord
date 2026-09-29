import type { SupabaseClient } from "@supabase/supabase-js";

// Share only structured goals. Free-text notes, health limits, and chat transcripts
// remain in the specialist that collected them.
export async function getSharedCoachingGoals(supabase: SupabaseClient, userId: string) {
  const [running, strength] = await Promise.all([
    supabase.from("running_coach_profiles")
      .select("goal_type,target_date,target_distance_miles,target_time_minutes,max_runs_per_week,long_run_day,updated_at")
      .eq("user_id", userId).maybeSingle(),
    supabase.from("strength_coach_profiles")
      .select("primary_goal,min_sessions_per_week,max_sessions_per_week,updated_at")
      .eq("user_id", userId).maybeSingle(),
  ]);
  if (running.error) throw new Error(`Unable to read shared running goal: ${running.error.message}`);
  if (strength.error) throw new Error(`Unable to read shared strength goal: ${strength.error.message}`);
  return {
    as_of: new Date().toISOString(),
    running: running.data,
    strength: strength.data,
    nutrition: null,
    source: "Saved, user-owned coaching profiles only",
    note: "A missing goal is unknown, not a decision to skip that area. Free-text limits and specialist conversations are not shared.",
  };
}
