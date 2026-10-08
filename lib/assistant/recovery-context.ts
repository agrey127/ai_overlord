import type { SupabaseClient } from "@supabase/supabase-js";
import { getSharedCoachingGoals } from "@/lib/assistant/coaching-goals";
import { queryPersonalTotals } from "@/lib/assistant/personal-totals";

function localDay(timestamp: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.APP_TIME_ZONE ?? "America/Indiana/Indianapolis",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function summarizeRecovery(completedAt: string[], asOf: string) {
  const days = [...new Set(completedAt.map(localDay))].sort().reverse();
  const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;
  let consecutiveDays = days.length ? 1 : 0;
  while (consecutiveDays < days.length
    && dayNumber(days[consecutiveDays - 1]) - dayNumber(days[consecutiveDays]) === 1) consecutiveDays++;
  return {
    as_of: localDay(asOf),
    completed_sessions_in_window: completedAt.length,
    latest_training_day: days[0] ?? null,
    previous_training_day: days[1] ?? null,
    full_rest_days_between_latest_training_days: days.length > 1
      ? dayNumber(days[0]) - dayNumber(days[1]) - 1 : null,
    consecutive_strength_training_days_ending_latest: consecutiveDays,
    days_since_latest_training: days.length ? dayNumber(localDay(asOf)) - dayNumber(days[0]) : null,
    note: "Training days use local completion dates. Multiple sessions on one day count as one training day. Rest here means no recorded strength session, not absence of running or other activity. History window is 90 days.",
  };
}

export async function getRecoveryContext(supabase: SupabaseClient, userId: string) {
  const asOf = new Date().toISOString();
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const sources = {
    shared_goals: () => getSharedCoachingGoals(supabase, userId),
    strength: async () => {
      const { data, error } = await supabase.from("strength_workout_plans")
        .select("completed_at").eq("user_id", userId).eq("status", "completed")
        .gte("completed_at", since).lte("completed_at", asOf)
        .order("completed_at", { ascending: false }).limit(1000);
      if (error) throw new Error("Strength history unavailable");
      if ((data ?? []).length === 1000) throw new Error("Strength history exceeds review window capacity");
      return summarizeRecovery((data ?? []).map(row => row.completed_at as string), asOf);
    },
    running_distance: () => queryPersonalTotals(supabase, userId, { dataset: "runs", metric: "distance_miles", period: "last_7_days", start_date: null, end_date: null }),
    running_duration: () => queryPersonalTotals(supabase, userId, { dataset: "runs", metric: "duration_minutes", period: "last_7_days", start_date: null, end_date: null }),
    calories: () => queryPersonalTotals(supabase, userId, { dataset: "meal_logs", metric: "calories", period: "last_7_days", start_date: null, end_date: null }),
    protein: () => queryPersonalTotals(supabase, userId, { dataset: "meal_logs", metric: "protein_g", period: "last_7_days", start_date: null, end_date: null }),
    carbs: () => queryPersonalTotals(supabase, userId, { dataset: "meal_logs", metric: "carbs_g", period: "last_7_days", start_date: null, end_date: null }),
  };
  const entries = Object.entries(sources);
  const results = await Promise.allSettled(entries.map(([, read]) => read()));
  return Object.fromEntries(entries.map(([name], index) => [name,
    results[index].status === "fulfilled" ? results[index].value : { unavailable: true },
  ]));
}
