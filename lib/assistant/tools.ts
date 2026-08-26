import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunctionTool } from "openai/resources/responses/responses";
import {
  completeTodayWorkout,
  deleteStrengthSet,
  ensureTodayWorkout,
  getStrengthProgress,
  logStrengthSet,
  replaceTodayWorkout,
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
    description: "Mark today's scheduled strength workout as in progress. Use only when the user asks to start it.",
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
              rest_seconds: { type: ["integer", "null"], minimum: 0, maximum: 1800 },
              notes: { type: ["string", "null"] },
            },
            required: ["exercise_name", "target_sets", "target_reps", "rest_seconds", "notes"],
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
    description: "Mark today's strength workout completed. Use only after the user explicitly says the workout is finished.",
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
                rest_seconds: exercise.rest_seconds == null ? null : Number(exercise.rest_seconds),
                notes: exercise.notes == null ? null : String(exercise.notes),
              };
            })
          : [],
        confirm_destructive: args.confirm_destructive === true,
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
