import { supabaseClient } from "@/lib/supabase/client";
import { requireUserId } from "@/lib/supabase/server";

export type RelationshipStatusRow = {
  user_id: string;
  commitment_id: string;
  name: string;
  category: string | null;
  frequency: string;
  target_count: number;
  notes: string | null;
  period_start: string;
  period_end: string;
  days_remaining: number;
  completed_count: number;
  planned_for: string | null;
  status: "overdue" | "unplanned" | "planned" | "completed" | string;
};

export async function fetchRelationshipStatus(userId?: string) {
  userId = userId ?? await requireUserId();
  const supabase = await supabaseClient();

  const { data, error } = await supabase
    .from("v_relationship_status")
    .select(
      "user_id, commitment_id, name, category, frequency, target_count, notes, period_start, period_end, days_remaining, completed_count, planned_for, status"
    )
    .eq("user_id", userId);

  if (error) {
    console.error("fetchRelationshipStatus error:", error.message);
    return [];
  }

  return (data ?? []) as RelationshipStatusRow[];
}
