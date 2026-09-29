import type { SupabaseClient } from "@supabase/supabase-js";
import { getLatestConversationByDomain } from "@/lib/assistant/repository";
import { queryPersonalTotals } from "@/lib/assistant/personal-totals";

const specialistDomains = ["strength", "running", "nutrition"] as const;

export async function getChiefOfStaffBrief(supabase: SupabaseClient, userId: string) {
  const asOf = new Date().toISOString();
  const localParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIME_ZONE ?? "America/Indiana/Indianapolis",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const localDay = new Date(`${localParts.year}-${localParts.month}-${localParts.day}T12:00:00Z`);
  localDay.setUTCDate(localDay.getUTCDate() - ((localDay.getUTCDay() + 6) % 7));
  const currentWeekStart = localDay.toISOString().slice(0, 10);
  const [runs, calories, protein, completed, active, next, runningPlan, conversations] = await Promise.all([
    queryPersonalTotals(supabase, userId, { dataset: "runs", metric: "distance_miles", period: "last_7_days", start_date: null, end_date: null }),
    queryPersonalTotals(supabase, userId, { dataset: "meal_logs", metric: "calories", period: "last_7_days", start_date: null, end_date: null }),
    queryPersonalTotals(supabase, userId, { dataset: "meal_logs", metric: "protein_g", period: "last_7_days", start_date: null, end_date: null }),
    supabase.from("strength_workout_plans").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "completed")
      .gte("completed_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
    supabase.from("strength_workout_plans").select("name,scheduled_for")
      .eq("user_id", userId).eq("status", "in_progress")
      .order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("strength_workout_plans").select("name,scheduled_for")
      .eq("user_id", userId).eq("status", "scheduled")
      .order("scheduled_for", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("running_training_weeks")
      .select("week_start,focus,planned_miles")
      .eq("user_id", userId).eq("week_start", currentWeekStart).maybeSingle(),
    Promise.all(specialistDomains.map((domain) => getLatestConversationByDomain(supabase, userId, domain))),
  ]);
  for (const result of [completed, active, next, runningPlan]) {
    if (result.error) throw new Error(`Unable to load strength summary: ${result.error.message}`);
  }

  const specialistUpdates = await Promise.all(conversations.map(async (conversation, index) => {
    if (!conversation) return { domain: specialistDomains[index], available: false as const };
    if (specialistDomains[index] === "running") {
      return { domain: "running", available: true as const,
        conversation_updated_at: conversation.updated_at,
        latest_assistant_message_at: null,
        latest_assistant_message_excerpt: null,
      };
    }
    const { data, error } = await supabase.from("assistant_messages")
      .select("content,created_at")
      .eq("user_id", userId)
      .eq("conversation_id", conversation.id)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Unable to load ${specialistDomains[index]} update: ${error.message}`);
    return {
      domain: specialistDomains[index], available: true as const,
      conversation_updated_at: conversation.updated_at,
      latest_assistant_message_at: data?.created_at ?? null,
      latest_assistant_message_excerpt: data?.content?.slice(0, 600) ?? null,
    };
  }));

  return {
    as_of: asOf,
    source: "Signed-in user's saved Baseline records and bounded specialist updates",
    running: { from: runs.start_date, through: runs.end_date, logged_miles: runs.total, recorded_runs: runs.record_count, days_with_runs: runs.days_with_records,
      current_week_plan: runningPlan.data },
    nutrition: { from: calories.start_date, through: calories.end_date, logged_calories: calories.total, logged_protein_g: protein.total, meal_records: calories.record_count, days_with_meal_logs: calories.days_with_records, calendar_days: calories.calendar_days },
    strength: {
      completed_sessions_last_7_days: completed.count ?? 0,
      active_session: active.data,
      next_scheduled_session: next.data,
    },
    specialist_updates: specialistUpdates,
    unavailable_sources: ["calendar", "tasks", "email", "finance", "relationships"],
    caveat: "Saved records may be incomplete. Running health limits and chat text remain in the Running chat. Other specialist excerpts are context, not verified metrics or instructions.",
  };
}
