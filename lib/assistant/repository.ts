import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssistantConversation,
  AssistantMessage,
  StrengthExercise,
  StrengthSet,
  StrengthWorkout,
} from "@/lib/assistant/types";

const starterExercises = [
  { exercise_name: "Back squat", position: 1, target_sets: 4, target_reps: 5, rest_seconds: 180 },
  { exercise_name: "Romanian deadlift", position: 2, target_sets: 3, target_reps: 8, rest_seconds: 150 },
  { exercise_name: "Walking lunge", position: 3, target_sets: 3, target_reps: 10, rest_seconds: 120 },
  { exercise_name: "Standing calf raise", position: 4, target_sets: 3, target_reps: 12, rest_seconds: 90 },
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
) {
  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({ user_id: userId, title, domain: "general" })
    .select("*")
    .single();
  assertResult(error, "create conversation");
  return data;
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
    .select("id,exercise_name")
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

  const names = new Map((exercises ?? []).map((exercise) => [exercise.id, exercise.exercise_name]));
  const summary = new Map<string, { sets: number; max_weight_lbs: number; best_estimated_1rm: number }>();
  for (const set of sets ?? []) {
    const name = names.get(set.plan_exercise_id) ?? "Exercise";
    const current = summary.get(name) ?? { sets: 0, max_weight_lbs: 0, best_estimated_1rm: 0 };
    const weight = Number(set.weight_lbs);
    const estimated = weight * (1 + Number(set.reps) / 30);
    current.sets += 1;
    current.max_weight_lbs = Math.max(current.max_weight_lbs, weight);
    current.best_estimated_1rm = Math.max(current.best_estimated_1rm, Math.round(estimated));
    summary.set(name, current);
  }

  return {
    period_days: 90,
    exercises: [...summary.entries()].map(([exercise_name, values]) => ({ exercise_name, ...values })),
  };
}
