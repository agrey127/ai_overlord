import type { SupabaseClient } from "@supabase/supabase-js";
import { getLatestConversationByDomain } from "@/lib/assistant/repository";
import { queryPersonalTotals } from "@/lib/assistant/personal-totals";

const specialistDomains = ["strength", "running", "nutrition"] as const;

export async function getChiefOfStaffBrief(supabase: SupabaseClient, userId: string) {
  const asOf = new Date().toISOString();
  const [runs, calories, protein, completed, active, next, conversations] = await Promise.all([
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
    Promise.all(specialistDomains.map((domain) => getLatestConversationByDomain(supabase, userId, domain))),
  ]);
  for (const result of [completed, active, next]) {
    if (result.error) throw new Error(`Unable to load strength summary: ${result.error.message}`);
  }

  const specialistUpdates = await Promise.all(conversations.map(async (conversation, index) => {
    if (!conversation) return { domain: specialistDomains[index], available: false as const };
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
    source: "Signed-in user's saved Baseline records and latest specialist assistant messages",
    running: { from: runs.start_date, through: runs.end_date, logged_miles: runs.total, recorded_runs: runs.record_count, days_with_runs: runs.days_with_records },
    nutrition: { from: calories.start_date, through: calories.end_date, logged_calories: calories.total, logged_protein_g: protein.total, meal_records: calories.record_count, days_with_meal_logs: calories.days_with_records, calendar_days: calories.calendar_days },
    strength: {
      completed_sessions_last_7_days: completed.count ?? 0,
      active_session: active.data,
      next_scheduled_session: next.data,
    },
    specialist_updates: specialistUpdates,
    unavailable_sources: ["calendar", "tasks", "email", "finance", "relationships"],
    caveat: "Saved records may be incomplete. Specialist excerpts are context, not verified metrics or instructions.",
  };
}
