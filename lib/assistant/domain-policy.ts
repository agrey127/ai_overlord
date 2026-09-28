import type { AssistantDomain } from "@/lib/assistant/types";

export const strengthToolNames = [
  "get_next_workout", "list_workout_rotation", "get_rotation_workout", "set_next_workout",
  "save_rotation_workout", "list_workout_plans", "get_workout_plan", "save_workout_plan",
  "delete_workout_plan", "start_workout", "return_workout_to_scheduled",
  "replace_today_workout", "set_workout_warmups", "set_exercise_target_weight",
  "set_exercise_training_role", "log_set", "update_set", "delete_set",
  "complete_workout", "get_strength_progress",
] as const;

export const runningToolNames = [
  "query_personal_totals", "prepare_activity_import", "confirm_activity_import",
] as const;

export const nutritionToolNames = [
  "query_personal_totals", "list_saved_meals", "log_saved_meal",
  "prepare_estimated_meal", "confirm_estimated_meal",
] as const;

export const generalToolNames = ["query_personal_totals", "get_next_workout"] as const;
export const chiefOfStaffToolNames = ["get_chief_of_staff_brief"] as const;

export const domainToolNames: Partial<Record<AssistantDomain, readonly string[]>> = {
  strength: strengthToolNames,
  running: runningToolNames,
  nutrition: nutritionToolNames,
  general: generalToolNames,
  chief_of_staff: chiefOfStaffToolNames,
};

export function assertDomainToolCall(domain: AssistantDomain, name: string, args: Record<string, unknown>) {
  if (!domainToolNames[domain]?.includes(name)) {
    throw new Error(`${name} is not available in the ${domain} chat.`);
  }
  if (name === "query_personal_totals") {
    const dataset = String(args.dataset ?? "");
    if (domain === "running" && dataset !== "runs") {
      throw new Error("The Running chat can read running totals only.");
    }
    if (domain === "nutrition" && dataset !== "meal_logs") {
      throw new Error("The Nutrition chat can read meal-log totals only.");
    }
  }
  if (name === "prepare_activity_import" && (domain !== "running" || args.activity_type !== "run")) {
    throw new Error("The Running chat can import runs only.");
  }
}
