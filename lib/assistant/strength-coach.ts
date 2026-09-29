import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentOrNextWorkout, getStrengthProgress, listWorkoutRotation } from "@/lib/assistant/repository";
import { getSharedCoachingGoals } from "@/lib/assistant/coaching-goals";

export type StrengthCoachProfileInput = {
  primary_goal: "maintain_strength" | "build_strength" | "build_muscle" | "general_fitness";
  goal_description: string;
  min_sessions_per_week: number;
  max_sessions_per_week: number;
  available_days: number[];
  preferred_session_minutes: number | null;
  equipment: string | null;
  training_limits: string | null;
};

export function validateStrengthProfile(input: StrengthCoachProfileInput): StrengthCoachProfileInput {
  if (!["maintain_strength", "build_strength", "build_muscle", "general_fitness"].includes(input.primary_goal)) {
    throw new Error("Choose a supported strength goal.");
  }
  const description = input.goal_description.trim();
  if (!description || description.length > 500) throw new Error("Describe the strength goal in 1 to 500 characters.");
  if (!Number.isInteger(input.min_sessions_per_week) || !Number.isInteger(input.max_sessions_per_week)
    || input.min_sessions_per_week < 1 || input.max_sessions_per_week > 7
    || input.min_sessions_per_week > input.max_sessions_per_week) {
    throw new Error("Choose a range of 1 to 7 strength sessions per week.");
  }
  if (!Array.isArray(input.available_days) || input.available_days.length > 7
    || input.available_days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
    || new Set(input.available_days).size !== input.available_days.length) {
    throw new Error("Available days must be distinct weekdays numbered Monday=1 through Sunday=7.");
  }
  if (input.available_days.length && input.max_sessions_per_week > input.available_days.length) {
    throw new Error("The maximum strength sessions cannot exceed available days.");
  }
  if (input.preferred_session_minutes !== null && (!Number.isInteger(input.preferred_session_minutes)
    || input.preferred_session_minutes < 15 || input.preferred_session_minutes > 240)) {
    throw new Error("Preferred session length must be 15 to 240 minutes.");
  }
  const equipment = input.equipment?.trim() || null;
  const limits = input.training_limits?.trim() || null;
  if (equipment && equipment.length > 500) throw new Error("Equipment notes must be at most 500 characters.");
  if (limits && limits.length > 1000) throw new Error("Training limits must be at most 1000 characters.");
  return { ...input, goal_description: description, equipment, training_limits: limits,
    available_days: [...input.available_days].sort((a, b) => a - b) };
}

export async function getStrengthCoachContext(supabase: SupabaseClient, userId: string) {
  const since = new Date(Date.now() - 42 * 86_400_000).toISOString().slice(0, 10);
  const [profile, sessions, rotation, next, progress, sharedGoals] = await Promise.all([
    supabase.from("strength_coach_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("strength_workout_plans")
      .select("id,name,status,scheduled_for,started_at,completed_at,estimated_minutes")
      .eq("user_id", userId).gte("scheduled_for", since)
      .order("scheduled_for", { ascending: false }).limit(30),
    listWorkoutRotation(supabase, userId),
    getCurrentOrNextWorkout(supabase, userId),
    getStrengthProgress(supabase, userId),
    getSharedCoachingGoals(supabase, userId),
  ]);
  if (profile.error) throw new Error(`Unable to read strength profile: ${profile.error.message}`);
  if (sessions.error) throw new Error(`Unable to read strength history: ${sessions.error.message}`);
  return {
    as_of: new Date().toISOString(), profile: profile.data,
    rotation: rotation.workouts, current_or_next_workout: next,
    recent_sessions: sessions.data ?? [], recent_sessions_truncated: (sessions.data ?? []).length === 30,
    progress, shared_goals: sharedGoals,
    data_note: "Session history and progress reflect saved records only. The rotation is independent of weekdays; missing logs do not prove missed training.",
  };
}

export async function prepareStrengthCoachProfile(
  supabase: SupabaseClient, userId: string, conversationId: string, input: StrengthCoachProfileInput,
) {
  const payload = validateStrengthProfile(input);
  const { data, error } = await supabase.from("strength_coach_drafts")
    .insert({ user_id: userId, conversation_id: conversationId, payload })
    .select("id").single();
  if (error) throw new Error(`Unable to prepare strength profile: ${error.message}`);
  return { confirmation_required: true, draft_id: data!.id, profile: payload };
}

export async function confirmStrengthCoachProfile(
  supabase: SupabaseClient, userId: string, conversationId: string, draftId: string,
) {
  const { data, error } = await supabase.rpc("confirm_strength_coach_draft", {
    p_user_id: userId, p_conversation_id: conversationId, p_draft_id: draftId,
  });
  if (error) throw new Error(`Unable to save strength profile: ${error.message}`);
  return data;
}
