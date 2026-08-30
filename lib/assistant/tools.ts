import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunctionTool } from "openai/resources/responses/responses";
import type { ActivityType, StrengthTrainingRole } from "@/lib/assistant/types";
import {
  confirmActivityImport,
  completeTodayWorkout,
  deleteStrengthWorkoutPlan,
  deleteStrengthSet,
  getCurrentOrNextWorkout,
  getRotationWorkout,
  getStrengthWorkoutPlan,
  getStrengthProgress,
  listStrengthWorkoutPlans,
  listWorkoutRotation,
  logStrengthSet,
  prepareActivityImport,
  replaceTodayWorkout,
  returnTodayWorkoutToScheduled,
  saveStrengthWorkoutPlan,
  saveRotationWorkout,
  setExerciseTargetWeight,
  setExerciseTrainingRole,
  setTodayWorkoutWarmups,
  setNextRotationWorkout,
  startNextWorkout,
  updateStrengthSet,
} from "@/lib/assistant/repository";

export const assistantTools: FunctionTool[] = [
  {
    type: "function",
    name: "prepare_activity_import",
    description: "Prepare a confirmation-required activity draft from Garmin screenshots or explicit user data. This does not save an activity. Use exact visible values only; convert kilometers to miles and metric pace to minutes per mile when necessary, and explain conversions to the user. Never guess missing values.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        activity_type: { type: "string", enum: ["run", "bike", "walk", "swim", "strength", "other"] },
        activity_date: { type: "string", description: "Calendar date in YYYY-MM-DD format." },
        duration_minutes: { type: "number", minimum: 0, maximum: 1440 },
        calories_burned: { type: "number", minimum: 0, maximum: 10000 },
        distance_miles: { type: ["number", "null"], minimum: 0, maximum: 1000 },
        average_heart_rate: { type: ["integer", "null"], minimum: 0, maximum: 300 },
        cadence: { type: ["integer", "null"], minimum: 0, maximum: 300 },
        pace_min_per_mile: { type: ["number", "null"], minimum: 0, maximum: 120 },
        notes: { type: ["string", "null"], maxLength: 1000 },
      },
      required: ["activity_type", "activity_date", "duration_minutes", "calories_burned", "distance_miles", "average_heart_rate", "cadence", "pace_min_per_mile", "notes"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "confirm_activity_import",
    description: "Save one previously prepared Garmin activity draft. Call only after the user explicitly confirms the displayed draft. Pass only the exact pending draft ID returned by prepare_activity_import.",
    strict: true,
    parameters: {
      type: "object",
      properties: { draft_id: { type: "string" } },
      required: ["draft_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_next_workout",
    description: "Read the active strength session, or the next workout in the rotation when no session is active. This is independent of the calendar date.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "list_workout_rotation",
    description: "List the reusable strength workout rotation in order. Use this—not dated session history—to understand Day 1, Day 2, Day 3, Day 4, and so on.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "get_rotation_workout",
    description: "Read one reusable workout in the rotation, including all exercises and targets.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        template_id: { type: ["string", "null"] },
        rotation_position: { type: ["integer", "null"], minimum: 1, maximum: 50 },
      },
      required: ["template_id", "rotation_position"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "set_next_workout",
    description: "Manually set which rotation position is next. Use when the user corrects the pointer; this does not complete, skip, or delete any workout.",
    strict: true,
    parameters: {
      type: "object",
      properties: { rotation_position: { type: "integer", minimum: 1, maximum: 50 } },
      required: ["rotation_position"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "save_rotation_workout",
    description: "Create or fully update one reusable workout in the rotation. Read it first when editing and include every exercise that should remain. This changes future sessions, not completed history.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        template_id: { type: ["string", "null"] },
        rotation_position: { type: "integer", minimum: 1, maximum: 50 },
        name: { type: "string", minLength: 1, maxLength: 160 },
        estimated_minutes: { type: "integer", minimum: 1, maximum: 360 },
        warmups: { type: "array", minItems: 0, maxItems: 10, items: { type: "string", maxLength: 160 } },
        notes: { type: ["string", "null"], maxLength: 1000 },
        active: { type: "boolean" },
        exercises: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              id: { type: ["string", "null"] },
              exercise_name: { type: "string", minLength: 1, maxLength: 160 },
              target_sets: { type: "integer", minimum: 1, maximum: 20 },
              target_reps: { type: "integer", minimum: 1, maximum: 100 },
              target_weight_lbs: { type: ["number", "null"], minimum: 0, maximum: 3000 },
              training_role: { type: "string", enum: ["standard", "heavy", "volume", "light", "technique", "accessory", "bodyweight"] },
              rest_seconds: { type: "integer", minimum: 0, maximum: 1800 },
              notes: { type: ["string", "null"], maxLength: 1000 },
            },
            required: ["id", "exercise_name", "target_sets", "target_reps", "target_weight_lbs", "training_role", "rest_seconds", "notes"],
            additionalProperties: false,
          },
        },
      },
      required: ["template_id", "rotation_position", "name", "estimated_minutes", "warmups", "notes", "active", "exercises"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_workout_plans",
    description: "List dated strength workout session history. Do not use this to decide which workout is next; use list_workout_rotation or get_next_workout.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        date_from: { type: ["string", "null"], description: "Optional inclusive YYYY-MM-DD start date." },
        date_to: { type: ["string", "null"], description: "Optional inclusive YYYY-MM-DD end date." },
      },
      required: ["date_from", "date_to"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_workout_plan",
    description: "Read one saved strength workout plan with its complete prescription and logged sets. Prefer an exact plan ID from list_workout_plans; otherwise provide a date. If both are null, reads today's plan without creating one.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        plan_id: { type: ["string", "null"] },
        scheduled_for: { type: ["string", "null"], description: "Workout date in YYYY-MM-DD format." },
      },
      required: ["plan_id", "scheduled_for"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "save_workout_plan",
    description: "Create or fully update a saved strength workout plan. Read an existing plan first, then include every exercise that should remain. Preserve each existing exercise ID when editing or reordering it; use null only for a new exercise. Omitting an existing ID removes that exercise. If removal would delete logged sets, first call with confirm_destructive=false and retry with true only after explicit confirmation.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        plan_id: { type: ["string", "null"], description: "Existing plan ID, or null to create a plan for the supplied date." },
        scheduled_for: { type: "string", description: "Workout date in YYYY-MM-DD format." },
        name: { type: "string", minLength: 1, maxLength: 160 },
        estimated_minutes: { type: "integer", minimum: 1, maximum: 360 },
        warmups: {
          type: "array",
          minItems: 0,
          maxItems: 10,
          items: { type: "string", maxLength: 160 },
        },
        notes: { type: ["string", "null"], maxLength: 1000 },
        exercises: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              id: { type: ["string", "null"], description: "Existing exercise ID, or null for a new exercise." },
              exercise_name: { type: "string", minLength: 1, maxLength: 160 },
              target_sets: { type: "integer", minimum: 1, maximum: 20 },
              target_reps: { type: "integer", minimum: 1, maximum: 100 },
              target_weight_lbs: { type: ["number", "null"], minimum: 0, maximum: 3000 },
              training_role: { type: "string", enum: ["standard", "heavy", "volume", "light", "technique", "accessory", "bodyweight"] },
              rest_seconds: { type: "integer", minimum: 0, maximum: 1800 },
              notes: { type: ["string", "null"], maxLength: 1000 },
            },
            required: ["id", "exercise_name", "target_sets", "target_reps", "target_weight_lbs", "training_role", "rest_seconds", "notes"],
            additionalProperties: false,
          },
        },
        confirm_destructive: { type: "boolean" },
      },
      required: ["plan_id", "scheduled_for", "name", "estimated_minutes", "warmups", "notes", "exercises", "confirm_destructive"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_workout_plan",
    description: "Delete an entire saved strength workout plan. Call with confirm_destructive=false first. A started/completed plan or one with logged sets requires explicit user confirmation before retrying with true.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        plan_id: { type: "string" },
        confirm_destructive: { type: "boolean" },
      },
      required: ["plan_id", "confirm_destructive"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "start_workout",
    description: "Start or resume the next workout in the rotation. Starting creates a dated session but does not advance the rotation; completion advances it.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "return_workout_to_scheduled",
    description: "Pause the active strength session without deleting sets or advancing the rotation.",
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
    description: "Set or clear the planned working weight for an exercise in the active session or next rotation workout. Never copy a heavy target to a volume, light, or technique occurrence. Use only when the user supplies the weight or explicitly asks to clear it.",
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
    description: "Classify one exercise in the active session or next rotation workout so its target and progress remain separate from other versions of the same lift.",
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
    description: "Start the next workout if needed, then create or replace one logged set after the user provides the exercise, weight, and reps.",
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
    description: "Complete the active strength session, create its duplicate-safe activity, and advance the persistent rotation pointer exactly once. Never call this merely because a date changed.",
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
  context?: { conversationId: string },
) {
  const args = (rawArguments ? JSON.parse(rawArguments) : {}) as ToolArguments;

  switch (name) {
    case "prepare_activity_import":
      if (!context?.conversationId) throw new Error("Activity imports require a conversation.");
      return prepareActivityImport(supabase, userId, context.conversationId, {
        activity_type: String(args.activity_type) as ActivityType,
        activity_date: String(args.activity_date),
        duration_minutes: Number(args.duration_minutes),
        calories_burned: Number(args.calories_burned),
        distance_miles: args.distance_miles == null ? null : Number(args.distance_miles),
        average_heart_rate: args.average_heart_rate == null ? null : Number(args.average_heart_rate),
        cadence: args.cadence == null ? null : Number(args.cadence),
        pace_min_per_mile: args.pace_min_per_mile == null ? null : Number(args.pace_min_per_mile),
        notes: args.notes == null ? null : String(args.notes),
      });
    case "confirm_activity_import":
      return confirmActivityImport(supabase, userId, String(args.draft_id));
    case "get_next_workout":
      return getCurrentOrNextWorkout(supabase, userId);
    case "list_workout_rotation":
      return listWorkoutRotation(supabase, userId);
    case "get_rotation_workout":
      return getRotationWorkout(supabase, userId, {
        template_id: args.template_id == null ? null : String(args.template_id),
        rotation_position: args.rotation_position == null ? null : Number(args.rotation_position),
      });
    case "set_next_workout":
      return setNextRotationWorkout(supabase, userId, Number(args.rotation_position));
    case "save_rotation_workout":
      return saveRotationWorkout(supabase, userId, {
        template_id: args.template_id == null ? null : String(args.template_id),
        rotation_position: Number(args.rotation_position),
        name: String(args.name),
        estimated_minutes: Number(args.estimated_minutes),
        warmups: Array.isArray(args.warmups) ? args.warmups.map(String) : [],
        notes: args.notes == null ? null : String(args.notes),
        active: args.active === true,
        exercises: Array.isArray(args.exercises)
          ? args.exercises.map((item) => {
              const exercise = item as ToolArguments;
              return {
                id: exercise.id == null ? null : String(exercise.id),
                exercise_name: String(exercise.exercise_name),
                target_sets: Number(exercise.target_sets),
                target_reps: Number(exercise.target_reps),
                target_weight_lbs: exercise.target_weight_lbs == null ? null : Number(exercise.target_weight_lbs),
                training_role: String(exercise.training_role) as StrengthTrainingRole,
                rest_seconds: Number(exercise.rest_seconds),
                notes: exercise.notes == null ? null : String(exercise.notes),
              };
            })
          : [],
      });
    case "list_workout_plans":
      return listStrengthWorkoutPlans(supabase, userId, {
        date_from: args.date_from == null ? null : String(args.date_from),
        date_to: args.date_to == null ? null : String(args.date_to),
      });
    case "get_workout_plan":
      return getStrengthWorkoutPlan(supabase, userId, {
        plan_id: args.plan_id == null ? null : String(args.plan_id),
        scheduled_for: args.scheduled_for == null ? null : String(args.scheduled_for),
      });
    case "save_workout_plan":
      return saveStrengthWorkoutPlan(supabase, userId, {
        plan_id: args.plan_id == null ? null : String(args.plan_id),
        scheduled_for: String(args.scheduled_for),
        name: String(args.name),
        estimated_minutes: Number(args.estimated_minutes),
        warmups: Array.isArray(args.warmups) ? args.warmups.map(String) : [],
        notes: args.notes == null ? null : String(args.notes),
        exercises: Array.isArray(args.exercises)
          ? args.exercises.map((item) => {
              const exercise = item as ToolArguments;
              return {
                id: exercise.id == null ? null : String(exercise.id),
                exercise_name: String(exercise.exercise_name),
                target_sets: Number(exercise.target_sets),
                target_reps: Number(exercise.target_reps),
                target_weight_lbs: exercise.target_weight_lbs == null ? null : Number(exercise.target_weight_lbs),
                training_role: String(exercise.training_role) as StrengthTrainingRole,
                rest_seconds: Number(exercise.rest_seconds),
                notes: exercise.notes == null ? null : String(exercise.notes),
              };
            })
          : [],
        confirm_destructive: args.confirm_destructive === true,
      });
    case "delete_workout_plan":
      return deleteStrengthWorkoutPlan(supabase, userId, {
        plan_id: String(args.plan_id),
        confirm_destructive: args.confirm_destructive === true,
      });
    case "start_workout":
      return startNextWorkout(supabase, userId);
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
