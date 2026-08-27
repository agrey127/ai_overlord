import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityDraft,
  ActivityType,
  AssistantConversation,
  AssistantDomain,
  AssistantMessage,
  StrengthExercise,
  StrengthSet,
  StrengthTrainingRole,
  StrengthWorkout,
} from "@/lib/assistant/types";

const starterExercises = [
  { exercise_name: "Back squat", position: 1, target_sets: 4, target_reps: 5, training_role: "heavy", rest_seconds: 180 },
  { exercise_name: "Romanian deadlift", position: 2, target_sets: 3, target_reps: 8, training_role: "technique", rest_seconds: 150 },
  { exercise_name: "Walking lunge", position: 3, target_sets: 3, target_reps: 10, training_role: "accessory", rest_seconds: 120 },
  { exercise_name: "Standing calf raise", position: 4, target_sets: 3, target_reps: 12, training_role: "accessory", rest_seconds: 90 },
] as const;

function appDay() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIME_ZONE ?? "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function assertResult(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

export async function ensureTodayWorkout(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrengthWorkout> {
  const today = appDay();
  const { data: existing, error: existingError } = await supabase
    .from("strength_workout_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("scheduled_for", today)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  assertResult(existingError, "load today's workout");

  let plan = existing;
  if (!plan) {
    const { data, error } = await supabase
      .from("strength_workout_plans")
      .upsert(
        {
          user_id: userId,
          name: "Lower strength",
          scheduled_for: today,
          estimated_minutes: 52,
          status: "scheduled",
        },
        { onConflict: "user_id,scheduled_for,name" },
      )
      .select("*")
      .single();
    assertResult(error, "create starter workout");
    plan = data;
  }

  const { count, error: countError } = await supabase
    .from("strength_plan_exercises")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", plan.id)
    .eq("user_id", userId);
  assertResult(countError, "check workout exercises");

  if (!count) {
    const { error } = await supabase.from("strength_plan_exercises").insert(
      starterExercises.map((exercise) => ({
        ...exercise,
        plan_id: plan.id,
        user_id: userId,
      })),
    );
    assertResult(error, "create starter exercises");
  }

  return getWorkoutById(supabase, userId, plan.id);
}

export async function getWorkoutById(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
): Promise<StrengthWorkout> {
  const [{ data: plan, error: planError }, { data: exerciseRows, error: exerciseError }] =
    await Promise.all([
      supabase
        .from("strength_workout_plans")
        .select("*")
        .eq("id", planId)
        .eq("user_id", userId)
        .single(),
      supabase
        .from("strength_plan_exercises")
        .select("*")
        .eq("plan_id", planId)
        .eq("user_id", userId)
        .order("position"),
    ]);
  assertResult(planError, "load workout");
  assertResult(exerciseError, "load workout exercises");

  const exerciseIds = (exerciseRows ?? []).map((row) => row.id as string);
  const { data: setRows, error: setError } = exerciseIds.length
    ? await supabase
        .from("strength_sets")
        .select("*")
        .eq("user_id", userId)
        .in("plan_exercise_id", exerciseIds)
        .order("set_number")
    : { data: [], error: null };
  assertResult(setError, "load workout sets");

  const setsByExercise = new Map<string, StrengthSet[]>();
  for (const row of setRows ?? []) {
    const key = row.plan_exercise_id as string;
    const items = setsByExercise.get(key) ?? [];
    items.push({
      id: row.id,
      set_number: row.set_number,
      weight_lbs: Number(row.weight_lbs),
      reps: row.reps,
      rir: row.rir == null ? null : Number(row.rir),
      completed_at: row.completed_at,
    });
    setsByExercise.set(key, items);
  }

  const exercises: StrengthExercise[] = (exerciseRows ?? []).map((row) => ({
    id: row.id,
    exercise_name: row.exercise_name,
    position: row.position,
    target_sets: row.target_sets,
    target_reps: row.target_reps,
    target_weight_lbs: row.target_weight_lbs == null ? null : Number(row.target_weight_lbs),
    training_role: row.training_role as StrengthTrainingRole,
    rest_seconds: row.rest_seconds,
    notes: row.notes,
    sets: setsByExercise.get(row.id) ?? [],
  }));

  return {
    id: plan.id,
    name: plan.name,
    scheduled_for: plan.scheduled_for,
    estimated_minutes: plan.estimated_minutes,
    status: plan.status,
    started_at: plan.started_at,
    completed_at: plan.completed_at,
    warmups: Array.isArray(plan.warmups)
      ? plan.warmups.filter((item: unknown): item is string => typeof item === "string")
      : [],
    exercises,
  };
}

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
): Promise<AssistantConversation[]> {
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id,title,domain,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);
  assertResult(error, "load conversations");
  return (data ?? []) as AssistantConversation[];
}

export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  title = "New conversation",
  domain: AssistantDomain = "general",
) {
  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({ user_id: userId, title, domain })
    .select("*")
    .single();
  assertResult(error, "create conversation");
  return data;
}

export async function getLatestConversationByDomain(
  supabase: SupabaseClient,
  userId: string,
  domain: AssistantDomain,
): Promise<AssistantConversation | null> {
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id,title,domain,updated_at")
    .eq("user_id", userId)
    .eq("domain", domain)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertResult(error, "find conversation");
  return data as AssistantConversation | null;
}

export async function getConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();
  assertResult(error, "load conversation");
  return data;
}

export async function getMessages(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<AssistantMessage[]> {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .neq("role", "tool")
    .order("created_at", { ascending: true });
  assertResult(error, "load messages");
  return (data ?? []) as AssistantMessage[];
}

export async function saveMessage(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    userId: string;
    role: "user" | "assistant" | "tool";
    content: string;
    toolName?: string;
    toolCallId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      role: input.role,
      content: input.content,
      tool_name: input.toolName ?? null,
      tool_call_id: input.toolCallId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id,role,content,created_at")
    .single();
  assertResult(error, "save message");
  return data as AssistantMessage;
}

export async function updateConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  updates: { title?: string; last_response_id?: string; domain?: string },
) {
  const { error } = await supabase
    .from("assistant_conversations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);
  assertResult(error, "update conversation");
}

const activityTypes = new Set<ActivityType>([
  "run",
  "bike",
  "walk",
  "swim",
  "strength",
  "other",
]);

function requiredActivityNumber(
  value: number | null,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (value == null || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is required and must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function optionalActivityNumber(
  value: number | null,
  label: string,
  maximum: number,
) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be between 0 and ${maximum}.`);
  }
  return value;
}

export async function prepareActivityImport(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  input: Omit<ActivityDraft, "id">,
) {
  if (!activityTypes.has(input.activity_type)) {
    throw new Error(`Unsupported activity type: ${input.activity_type}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.activity_date)) {
    throw new Error("Activity date must use YYYY-MM-DD.");
  }
  const parsedDate = new Date(`${input.activity_date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.activity_date) {
    throw new Error("Activity date is invalid.");
  }

  const payload: Omit<ActivityDraft, "id"> = {
    activity_type: input.activity_type,
    activity_date: input.activity_date,
    duration_minutes: requiredActivityNumber(input.duration_minutes, "Duration", 0.01, 1440),
    calories_burned: requiredActivityNumber(input.calories_burned, "Calories", 0, 10000),
    distance_miles: optionalActivityNumber(input.distance_miles, "Distance", 1000),
    average_heart_rate: optionalActivityNumber(input.average_heart_rate, "Average heart rate", 300),
    cadence: optionalActivityNumber(input.cadence, "Cadence", 300),
    pace_min_per_mile: optionalActivityNumber(input.pace_min_per_mile, "Pace", 120),
    notes: input.notes?.trim().slice(0, 1000) || null,
  };
  const fingerprintFields = {
    activity_type: payload.activity_type,
    activity_date: payload.activity_date,
    duration_minutes: payload.duration_minutes,
    calories_burned: payload.calories_burned,
    distance_miles: payload.distance_miles,
    average_heart_rate: payload.average_heart_rate,
    cadence: payload.cadence,
    pace_min_per_mile: payload.pace_min_per_mile,
  };
  const sourceFingerprint = createHash("sha256")
    .update(JSON.stringify(fingerprintFields))
    .digest("hex");

  const { data: duplicate, error: duplicateError } = await supabase
    .from("activities")
    .select("id,activity_type,activity_date,duration_minutes,calories_burned,distance_miles,average_heart_rate,cadence,pace_min_per_mile,notes")
    .eq("user_id", userId)
    .eq("source_fingerprint", sourceFingerprint)
    .maybeSingle();
  assertResult(duplicateError, "check activity duplicate");
  if (duplicate) {
    return { confirmation_required: false, duplicate: true, activity: duplicate };
  }

  const { data, error } = await supabase
    .from("assistant_activity_drafts")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      payload,
      source_fingerprint: sourceFingerprint,
    })
    .select("id,payload")
    .single();
  assertResult(error, "prepare activity import");
  if (!data) throw new Error("Unable to read the prepared activity draft.");

  return {
    confirmation_required: true,
    duplicate: false,
    draft: { id: data.id, ...(data.payload as Omit<ActivityDraft, "id">) },
  };
}

export async function confirmActivityImport(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
) {
  const { data, error } = await supabase.rpc("confirm_activity_draft", {
    p_user_id: userId,
    p_draft_id: draftId,
  });
  assertResult(error, "confirm activity import");
  if (!data || typeof data !== "object") {
    throw new Error("confirm activity import: invalid database response");
  }
  return data;
}

export async function startTodayWorkout(supabase: SupabaseClient, userId: string) {
  const workout = await ensureTodayWorkout(supabase, userId);
  if (workout.status === "completed") return workout;

  const { error } = await supabase
    .from("strength_workout_plans")
    .update({ status: "in_progress", started_at: workout.started_at ?? new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", workout.id)
    .eq("user_id", userId);
  assertResult(error, "start workout");
  return getWorkoutById(supabase, userId, workout.id);
}

export async function returnTodayWorkoutToScheduled(
  supabase: SupabaseClient,
  userId: string,
) {
  const workout = await ensureTodayWorkout(supabase, userId);
  const { data, error } = await supabase.rpc("return_strength_workout_to_scheduled", {
    p_user_id: userId,
    p_plan_id: workout.id,
  });
  assertResult(error, "return workout to scheduled");
  if (!data || typeof data !== "object") {
    throw new Error("return workout to scheduled: invalid database response");
  }

  return {
    ...(data as Record<string, unknown>),
    workout: await getWorkoutById(supabase, userId, workout.id),
  };
}

export type ReplacementExercise = {
  exercise_name: string;
  target_sets: number;
  target_reps: number;
  target_weight_lbs?: number | null;
  training_role: StrengthTrainingRole;
  rest_seconds?: number | null;
  notes?: string | null;
};

export async function replaceTodayWorkout(
  supabase: SupabaseClient,
  userId: string,
  input: {
    name: string;
    estimated_minutes?: number | null;
    exercises: ReplacementExercise[];
    confirm_destructive: boolean;
  },
) {
  const currentWorkout = await ensureTodayWorkout(supabase, userId);
  const { data, error } = await supabase.rpc("replace_today_strength_workout", {
    p_user_id: userId,
    p_plan_id: currentWorkout.id,
    p_name: input.name,
    p_estimated_minutes: input.estimated_minutes ?? currentWorkout.estimated_minutes,
    p_exercises: input.exercises,
    p_confirm_destructive: input.confirm_destructive,
  });
  assertResult(error, "replace today's workout");
  if (!data || typeof data !== "object") {
    throw new Error("replace today's workout: invalid database response");
  }

  const result = data as {
    updated: boolean;
    confirmation_required: boolean;
    reason?: string;
    current_status?: string;
    logged_set_count?: number;
    removed_logged_sets?: number;
  };
  if (!result.updated) return { ...result, current_workout: currentWorkout };
  return { ...result, workout: await getWorkoutById(supabase, userId, currentWorkout.id) };
}

export async function setTodayWorkoutWarmups(
  supabase: SupabaseClient,
  userId: string,
  warmups: string[],
) {
  const workout = await ensureTodayWorkout(supabase, userId);
  const cleaned = warmups.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length > 10) throw new Error("A workout can have at most 10 warm-up items.");
  if (cleaned.some((item) => item.length > 160)) {
    throw new Error("Each warm-up item must be 160 characters or fewer.");
  }

  const { error } = await supabase
    .from("strength_workout_plans")
    .update({ warmups: cleaned, updated_at: new Date().toISOString() })
    .eq("id", workout.id)
    .eq("user_id", userId)
    .select("id")
    .single();
  assertResult(error, "update workout warm-ups");
  return getWorkoutById(supabase, userId, workout.id);
}

async function findExercise(
  supabase: SupabaseClient,
  userId: string,
  exerciseName: string,
) {
  const workout = await ensureTodayWorkout(supabase, userId);
  const direct = workout.exercises.find(
    (exercise) => exercise.exercise_name.toLowerCase() === exerciseName.toLowerCase(),
  );
  const partial = workout.exercises.find((exercise) =>
    exercise.exercise_name.toLowerCase().includes(exerciseName.toLowerCase()),
  );
  const exercise = direct ?? partial;
  if (!exercise) throw new Error(`Exercise not found in today's workout: ${exerciseName}`);
  return { workout, exercise };
}

export async function setExerciseTargetWeight(
  supabase: SupabaseClient,
  userId: string,
  input: { exercise_name: string; target_weight_lbs: number | null },
) {
  const { workout, exercise } = await findExercise(supabase, userId, input.exercise_name);
  if (
    input.target_weight_lbs != null
    && (!Number.isFinite(input.target_weight_lbs)
      || input.target_weight_lbs < 0
      || input.target_weight_lbs > 3000)
  ) {
    throw new Error("Target weight must be between 0 and 3000 lb.");
  }
  const { error } = await supabase
    .from("strength_plan_exercises")
    .update({ target_weight_lbs: input.target_weight_lbs })
    .eq("id", exercise.id)
    .eq("user_id", userId)
    .select("id")
    .single();
  assertResult(error, "update exercise target weight");
  return getWorkoutById(supabase, userId, workout.id);
}

const strengthTrainingRoles = new Set<StrengthTrainingRole>([
  "standard",
  "heavy",
  "volume",
  "light",
  "technique",
  "accessory",
  "bodyweight",
]);

export async function setExerciseTrainingRole(
  supabase: SupabaseClient,
  userId: string,
  input: { exercise_name: string; training_role: StrengthTrainingRole },
) {
  if (!strengthTrainingRoles.has(input.training_role)) {
    throw new Error(`Unsupported training role: ${input.training_role}`);
  }
  const { workout, exercise } = await findExercise(supabase, userId, input.exercise_name);
  const { error } = await supabase
    .from("strength_plan_exercises")
    .update({ training_role: input.training_role })
    .eq("id", exercise.id)
    .eq("user_id", userId)
    .select("id")
    .single();
  assertResult(error, "update exercise training role");
  return getWorkoutById(supabase, userId, workout.id);
}

export async function logStrengthSet(
  supabase: SupabaseClient,
  userId: string,
  input: { exercise_name: string; weight_lbs: number; reps: number; set_number?: number; rir?: number; notes?: string },
) {
  const { workout, exercise } = await findExercise(supabase, userId, input.exercise_name);
  const setNumber = input.set_number ?? exercise.sets.length + 1;

  const { data, error } = await supabase
    .from("strength_sets")
    .upsert(
      {
        plan_exercise_id: exercise.id,
        user_id: userId,
        set_number: setNumber,
        weight_lbs: input.weight_lbs,
        reps: input.reps,
        rir: input.rir ?? null,
        notes: input.notes ?? null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "plan_exercise_id,set_number" },
    )
    .select("id,set_number,weight_lbs,reps,rir,completed_at")
    .single();
  assertResult(error, "log set");
  if (!data) throw new Error("Unable to read the saved set.");

  if (workout.status === "scheduled") await startTodayWorkout(supabase, userId);
  return { ...data, weight_lbs: Number(data.weight_lbs), rir: data.rir == null ? null : Number(data.rir) };
}

export async function updateStrengthSet(
  supabase: SupabaseClient,
  userId: string,
  input: { set_id: string; weight_lbs?: number; reps?: number; rir?: number | null; notes?: string | null },
) {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([key, value]) => key !== "set_id" && value !== undefined),
  );
  const { data, error } = await supabase
    .from("strength_sets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", input.set_id)
    .eq("user_id", userId)
    .select("id,set_number,weight_lbs,reps,rir,completed_at")
    .single();
  assertResult(error, "update set");
  return data;
}

export async function deleteStrengthSet(
  supabase: SupabaseClient,
  userId: string,
  setId: string,
) {
  const { error } = await supabase
    .from("strength_sets")
    .delete()
    .eq("id", setId)
    .eq("user_id", userId);
  assertResult(error, "delete set");
  return { deleted: true, set_id: setId };
}

export async function completeTodayWorkout(supabase: SupabaseClient, userId: string) {
  const workout = await ensureTodayWorkout(supabase, userId);
  const { error } = await supabase
    .from("strength_workout_plans")
    .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", workout.id)
    .eq("user_id", userId);
  assertResult(error, "complete workout");
  return getWorkoutById(supabase, userId, workout.id);
}

export async function getStrengthProgress(supabase: SupabaseClient, userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data: exercises, error: exerciseError } = await supabase
    .from("strength_plan_exercises")
    .select("id,exercise_name,training_role")
    .eq("user_id", userId);
  assertResult(exerciseError, "load exercise history");
  const exerciseIds = (exercises ?? []).map((exercise) => exercise.id as string);
  if (!exerciseIds.length) return { period_days: 90, exercises: [] };

  const { data: sets, error: setError } = await supabase
    .from("strength_sets")
    .select("plan_exercise_id,weight_lbs,reps,completed_at")
    .eq("user_id", userId)
    .in("plan_exercise_id", exerciseIds)
    .gte("completed_at", since.toISOString())
    .order("completed_at", { ascending: true });
  assertResult(setError, "load strength progress");

  const identities = new Map((exercises ?? []).map((exercise) => [exercise.id, {
    exercise_name: exercise.exercise_name as string,
    training_role: exercise.training_role as StrengthTrainingRole,
  }]));
  const summary = new Map<string, {
    exercise_name: string;
    training_role: StrengthTrainingRole;
    sets: number;
    max_weight_lbs: number;
    best_estimated_1rm: number;
  }>();
  for (const set of sets ?? []) {
    const identity = identities.get(set.plan_exercise_id) ?? {
      exercise_name: "Exercise",
      training_role: "standard" as const,
    };
    const key = `${identity.exercise_name}\u0000${identity.training_role}`;
    const current = summary.get(key) ?? {
      ...identity,
      sets: 0,
      max_weight_lbs: 0,
      best_estimated_1rm: 0,
    };
    const weight = Number(set.weight_lbs);
    const estimated = weight * (1 + Number(set.reps) / 30);
    current.sets += 1;
    current.max_weight_lbs = Math.max(current.max_weight_lbs, weight);
    current.best_estimated_1rm = Math.max(current.best_estimated_1rm, Math.round(estimated));
    summary.set(key, current);
  }

  return {
    period_days: 90,
    exercises: [...summary.values()],
  };
}
