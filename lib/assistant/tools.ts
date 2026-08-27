import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunctionTool } from "openai/resources/responses/responses";
import type { StrengthTrainingRole } from "@/lib/assistant/types";
import {
  completeTodayWorkout,
  deleteStrengthSet,
  ensureTodayWorkout,
  getStrengthProgress,
  logStrengthSet,
  replaceTodayWorkout,
  returnTodayWorkoutToScheduled,
  setExerciseTargetWeight,
  setExerciseTrainingRole,
  setTodayWorkoutWarmups,
  startTodayWorkout,
  updateStrengthSet,
} from "@/lib/assistant/repository";

export const assistantTools: FunctionTool[] = [
  {
    type: "function",
    name: "get_today_workout",
    description: "Read today's strength workout, exercises, targets, status, and logged sets.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "start_workout",
    description: "Mark today's scheduled strength workout as in progress. Use only when the user asks to start it, then present the saved display-only warmups before the working exercises.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "return_workout_to_scheduled",
    description: "Return today's in-progress strength workout to scheduled status without deleting or changing any logged sets. Use only when the user explicitly asks to pause, undo starting, or return today's workout to scheduled.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "replace_today_workout",
    description: "Replace today's saved workout when the user explicitly corrects or changes the schedule and a complete intended exercise prescription is available from the conversation. An untouched scheduled workout can be replaced immediately. If it has started or contains sets, call with confirm_destructive=false first and ask for confirmation when the result requires it; use true only after explicit confirmation. Never invent missing exercises, sets, or reps.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        estimated_minutes: { type: ["integer", "null"], minimum: 1, maximum: 360 },
        exercises: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              exercise_name: { type: "string" },
              target_sets: { type: "integer", minimum: 1, maximum: 20 },
              target_reps: { type: "integer", minimum: 1, maximum: 100 },
              target_weight_lbs: { type: ["number", "null"], minimum: 0, maximum: 3000 },
              training_role: { type: "string", enum: ["standard", "heavy", "volume", "light", "technique", "accessory", "bodyweight"] },
              rest_seconds: { type: ["integer", "null"], minimum: 0, maximum: 1800 },
              notes: { type: ["string", "null"] },
            },
            required: ["exercise_name", "target_sets", "target_reps", "target_weight_lbs", "training_role", "rest_seconds", "notes"],
            additionalProperties: false,
          },
        },
        confirm_destructive: { type: "boolean" },
      },
      required: ["name", "estimated_minutes", "exercises", "confirm_destructive"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "set_workout_warmups",
    description: "Replace today's display-only warm-up checklist. Warm-ups are shown with the workout but are not logged as working sets or counted toward completion.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        warmups: {
          type: "array",
          minItems: 0,
          maxItems: 10,
          items: { type: "string", maxLength: 160 },
        },
      },
      required: ["warmups"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "set_exercise_target_weight",
    description: "Set or clear the planned working weight for this exact occurrence and training role of an exercise in today's workout. Never copy a heavy target to a volume, light, or technique occurrence. Use only when the user supplies the weight or explicitly asks to clear it.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        exercise_name: { type: "string" },
        target_weight_lbs: { type: ["number", "null"], minimum: 0, maximum: 3000 },
      },
      required: ["exercise_name", "target_weight_lbs"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "set_exercise_training_role",
    description: "Classify one exercise in today's workout as standard, heavy, volume, light, technique, accessory, or bodyweight so its target and progress remain separate from other versions of the same lift.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        exercise_name: { type: "string" },
        training_role: { type: "string", enum: ["standard", "heavy", "volume", "light", "technique", "accessory", "bodyweight"] },
      },
      required: ["exercise_name", "training_role"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "log_set",
    description: "Create or replace one set for an exercise in today's workout after the user provides the exercise, weight, and reps.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        exercise_name: { type: "string" },
        weight_lbs: { type: "number", minimum: 0, maximum: 3000 },
        reps: { type: "integer", minimum: 1, maximum: 200 },
        set_number: { type: ["integer", "null"], minimum: 1, maximum: 30 },
        rir: { type: ["number", "null"], minimum: 0, maximum: 10 },
        notes: { type: ["string", "null"] },
      },
      required: ["exercise_name", "weight_lbs", "reps", "set_number", "rir", "notes"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_set",
    description: "Update an existing logged set by its exact set ID. Use only when the user clearly asks to correct a set.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        set_id: { type: "string" },
        weight_lbs: { type: ["number", "null"], minimum: 0, maximum: 3000 },
        reps: { type: ["integer", "null"], minimum: 1, maximum: 200 },
        rir: { type: ["number", "null"], minimum: 0, maximum: 10 },
        notes: { type: ["string", "null"] },
      },
      required: ["set_id", "weight_lbs", "reps", "rir", "notes"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_set",
    description: "Delete one logged set by exact set ID. Use only when the user explicitly asks to delete it.",
    strict: true,
    parameters: {
      type: "object",
      properties: { set_id: { type: "string" } },
      required: ["set_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "complete_workout",
    description: "Mark today's strength workout completed after the user explicitly says they are finished. Completion is allowed even when some exercises or target sets were not completed; never invent missing sets.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "get_strength_progress",
    description: "Read a 90-day strength summary with set counts, top weights, and estimated one-rep maxes.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

type ToolArguments = Record<string, unknown>;

export async function runAssistantTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  rawArguments: string,
) {
  const args = (rawArguments ? JSON.parse(rawArguments) : {}) as ToolArguments;

  switch (name) {
    case "get_today_workout":
      return ensureTodayWorkout(supabase, userId);
    case "start_workout":
      return startTodayWorkout(supabase, userId);
    case "return_workout_to_scheduled":
      return returnTodayWorkoutToScheduled(supabase, userId);
    case "replace_today_workout":
      return replaceTodayWorkout(supabase, userId, {
        name: String(args.name),
        estimated_minutes: args.estimated_minutes == null ? null : Number(args.estimated_minutes),
        exercises: Array.isArray(args.exercises)
          ? args.exercises.map((item) => {
              const exercise = item as ToolArguments;
              return {
                exercise_name: String(exercise.exercise_name),
                target_sets: Number(exercise.target_sets),
                target_reps: Number(exercise.target_reps),
                target_weight_lbs: exercise.target_weight_lbs == null ? null : Number(exercise.target_weight_lbs),
                training_role: String(exercise.training_role) as StrengthTrainingRole,
                rest_seconds: exercise.rest_seconds == null ? null : Number(exercise.rest_seconds),
                notes: exercise.notes == null ? null : String(exercise.notes),
              };
            })
          : [],
        confirm_destructive: args.confirm_destructive === true,
      });
    case "set_workout_warmups":
      return setTodayWorkoutWarmups(
        supabase,
        userId,
        Array.isArray(args.warmups) ? args.warmups.map(String) : [],
      );
    case "set_exercise_target_weight":
      return setExerciseTargetWeight(supabase, userId, {
        exercise_name: String(args.exercise_name),
        target_weight_lbs: args.target_weight_lbs == null ? null : Number(args.target_weight_lbs),
      });
    case "set_exercise_training_role":
      return setExerciseTrainingRole(supabase, userId, {
        exercise_name: String(args.exercise_name),
        training_role: String(args.training_role) as StrengthTrainingRole,
      });
    case "log_set":
      return logStrengthSet(supabase, userId, {
        exercise_name: String(args.exercise_name),
        weight_lbs: Number(args.weight_lbs),
        reps: Number(args.reps),
        set_number: args.set_number == null ? undefined : Number(args.set_number),
        rir: args.rir == null ? undefined : Number(args.rir),
        notes: args.notes == null ? undefined : String(args.notes),
      });
    case "update_set":
      return updateStrengthSet(supabase, userId, {
        set_id: String(args.set_id),
        weight_lbs: args.weight_lbs == null ? undefined : Number(args.weight_lbs),
        reps: args.reps == null ? undefined : Number(args.reps),
        rir: args.rir == null ? null : Number(args.rir),
        notes: args.notes == null ? null : String(args.notes),
      });
    case "delete_set":
      return deleteStrengthSet(supabase, userId, String(args.set_id));
    case "complete_workout":
      return completeTodayWorkout(supabase, userId);
    case "get_strength_progress":
      return getStrengthProgress(supabase, userId);
    default:
      throw new Error(`Unknown assistant tool: ${name}`);
  }
}
