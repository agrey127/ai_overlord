import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityDraft,
  ActivityType,
  AssistantConversation,
  AssistantDomain,
  AssistantMessage,
  SavedMeal,
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

export async function listSavedMeals(
  supabase: SupabaseClient,
  userId: string,
): Promise<SavedMeal[]> {
  const { data, error } = await supabase
    .from("saved_meals")
    .select("id, name, description, calories, protein_g, carbs_g, fat_g")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  assertResult(error, "load saved meals");

  return (data ?? []).map((meal) => ({
    id: meal.id,
    name: meal.name,
    description: meal.description,
    calories: meal.calories == null ? null : Number(meal.calories),
    protein_g: meal.protein_g == null ? null : Number(meal.protein_g),
    carbs_g: meal.carbs_g == null ? null : Number(meal.carbs_g),
    fat_g: meal.fat_g == null ? null : Number(meal.fat_g),
  }));
}

async function getWorkoutTemplateById(
  supabase: SupabaseClient,
  userId: string,
  templateId: string,
): Promise<StrengthWorkout> {
  const [{ data: template, error: templateError }, { data: rows, error: exerciseError }] =
    await Promise.all([
      supabase
        .from("strength_workout_templates")
        .select("*")
        .eq("id", templateId)
        .eq("user_id", userId)
        .single(),
      supabase
        .from("strength_workout_template_exercises")
        .select("*")
        .eq("template_id", templateId)
        .eq("user_id", userId)
        .order("position"),
    ]);
  assertResult(templateError, "load workout rotation template");
  assertResult(exerciseError, "load workout rotation exercises");

  return {
    id: template.id,
    name: template.name,
    scheduled_for: null,
    estimated_minutes: template.estimated_minutes,
    notes: template.notes ?? null,
    status: "next",
    started_at: null,
    completed_at: null,
    warmups: Array.isArray(template.warmups)
      ? template.warmups.filter((item: unknown): item is string => typeof item === "string")
      : [],
    exercises: (rows ?? []).map((row) => ({
      id: row.id,
      exercise_name: row.exercise_name,
      position: row.position,
      target_sets: row.target_sets,
      target_reps: row.target_reps,
      target_weight_lbs: row.target_weight_lbs == null ? null : Number(row.target_weight_lbs),
      training_role: row.training_role as StrengthTrainingRole,
      rest_seconds: row.rest_seconds,
      notes: row.notes,
      sets: [],
    })),
    is_template: true,
    template_id: template.id,
    rotation_position: template.rotation_position,
  };
}

async function ensureStarterRotation(supabase: SupabaseClient, userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("strength_workout_templates")
    .select("id")
    .eq("user_id", userId)
    .eq("rotation_position", 1)
    .maybeSingle();
  assertResult(existingError, "find starter workout rotation");
  const created = existing ? { data: existing, error: null } : await supabase
    .from("strength_workout_templates")
    .insert({
      user_id: userId,
      name: "Lower strength",
      rotation_position: 1,
      estimated_minutes: 52,
    })
    .select("id")
    .single();
  assertResult(created.error, "create starter workout rotation");
  const template = created.data;
  if (!template) throw new Error("create starter workout rotation: no template returned");

  const { count, error: countError } = await supabase
    .from("strength_workout_template_exercises")
    .select("id", { count: "exact", head: true })
    .eq("template_id", template.id)
    .eq("user_id", userId);
  assertResult(countError, "check starter rotation exercises");
  if (!count) {
    const { error: insertError } = await supabase
      .from("strength_workout_template_exercises")
      .insert(starterExercises.map((exercise) => ({ ...exercise, template_id: template.id, user_id: userId })));
    assertResult(insertError, "create starter rotation exercises");
  }

  const { error: stateError } = await supabase
    .from("strength_workout_rotation_state")
    .upsert({ user_id: userId, next_template_id: template.id }, { onConflict: "user_id", ignoreDuplicates: true });
  assertResult(stateError, "initialize workout rotation");
  return template.id as string;
}

async function getNextWorkoutTemplate(supabase: SupabaseClient, userId: string) {
  const { data: state, error: stateError } = await supabase
    .from("strength_workout_rotation_state")
    .select("next_template_id")
    .eq("user_id", userId)
    .maybeSingle();
  assertResult(stateError, "load workout rotation state");

  let templateId = state?.next_template_id as string | null | undefined;
  if (templateId) {
    const { data: active, error } = await supabase
      .from("strength_workout_templates")
      .select("id")
      .eq("id", templateId)
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();
    assertResult(error, "validate next workout rotation template");
    templateId = active?.id;
  }

  if (!templateId) {
    const { data: first, error } = await supabase
      .from("strength_workout_templates")
      .select("id")
      .eq("user_id", userId)
      .eq("active", true)
      .order("rotation_position")
      .limit(1)
      .maybeSingle();
    assertResult(error, "find first workout rotation template");
    templateId = first?.id ?? await ensureStarterRotation(supabase, userId);
    const { error: updateError } = await supabase
      .from("strength_workout_rotation_state")
      .upsert({ user_id: userId, next_template_id: templateId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    assertResult(updateError, "repair workout rotation state");
  }

  if (!templateId) throw new Error("No active workout exists in the rotation.");
  return getWorkoutTemplateById(supabase, userId, templateId);
}

async function getActiveWorkoutSession(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("strength_workout_plans")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["in_progress", "scheduled"])
    .not("template_id", "is", null)
    .order("started_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertResult(error, "load active workout session");
  return data?.id ? getWorkoutById(supabase, userId, data.id) : null;
}

export type SavedMealLogInput = {
  saved_meal_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  confirm: boolean;
};

function dateInTimeZone(timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
  } catch {
    throw new Error("Your saved timezone is invalid. Update it under More → Profile & goals.");
  }
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function scaledNutritionValue(value: unknown, servings: number) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * servings * 100) / 100 : null;
}

export async function logSavedMeal(
  supabase: SupabaseClient,
  userId: string,
  input: SavedMealLogInput,
) {
  if (!["breakfast", "lunch", "dinner", "snack"].includes(input.meal_type)) {
    throw new Error("Choose breakfast, lunch, dinner, or snack.");
  }
  if (!Number.isFinite(input.servings) || input.servings <= 0 || input.servings > 20) {
    throw new Error("Servings must be between 0.01 and 20.");
  }

  const [mealResult, preferenceResult] = await Promise.all([
    supabase
      .from("saved_meals")
      .select("id,name,description,calories,protein_g,carbs_g,fat_g,saturated_fat_g,fiber_g,soluble_fiber_g,sugar_g,sodium_mg")
      .eq("id", input.saved_meal_id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_training_preferences")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  assertResult(mealResult.error, "load saved meal");
  assertResult(preferenceResult.error, "load timezone");
  if (!mealResult.data) throw new Error("That saved meal was not found in your account.");
  if (mealResult.data.calories == null) {
    throw new Error("Add calories to this saved meal before logging it.");
  }

  const meal = mealResult.data;
  const servings = input.servings;
  const mealDate = dateInTimeZone(
    preferenceResult.data?.timezone ?? "America/Indiana/Indianapolis",
  );
  const preview = {
    saved_meal_id: meal.id,
    meal_name: meal.name,
    meal_type: input.meal_type,
    meal_date: mealDate,
    servings,
    calories: scaledNutritionValue(meal.calories, servings),
    protein_g: scaledNutritionValue(meal.protein_g, servings),
    carbs_g: scaledNutritionValue(meal.carbs_g, servings),
    fat_g: scaledNutritionValue(meal.fat_g, servings),
  };

  if (!input.confirm) {
    return { logged: false, confirmation_required: true, preview };
  }

  const { data, error } = await supabase
    .from("meal_logs")
    .insert({
      user_id: userId,
      meal_type: input.meal_type,
      meal_date: mealDate,
      logged_at: new Date().toISOString(),
      food_name: meal.name,
      description: meal.description ?? meal.name,
      saved_meal_id: meal.id,
      serving_size: `${servings} serving${servings === 1 ? "" : "s"}`,
      calories: preview.calories,
      protein_g: preview.protein_g,
      carbs_g: preview.carbs_g,
      fat_g: preview.fat_g,
      saturated_fat_g: scaledNutritionValue(meal.saturated_fat_g, servings),
      fiber_g: scaledNutritionValue(meal.fiber_g, servings),
      soluble_fiber_g: scaledNutritionValue(meal.soluble_fiber_g, servings),
      sugar_g: scaledNutritionValue(meal.sugar_g, servings),
      sodium_mg: scaledNutritionValue(meal.sodium_mg, servings),
    })
    .select("id,meal_type,meal_date,calories,protein_g,carbs_g,fat_g")
    .single();
  assertResult(error, "log saved meal");

  return {
    logged: true,
    confirmation_required: false,
    meal: { ...data, meal_name: meal.name, servings },
  };
}

export type EstimatedMealDraftInput = {
  food_name: string;
  description: string;
  serving_size: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  meal_date: string | null;
  days_ago: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g: number | null;
  fiber_g: number | null;
  soluble_fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  assumptions: string[];
};

function estimatedNutritionNumber(
  value: number | null,
  label: string,
  maximum: number,
) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be between 0 and ${maximum}.`);
  }
  return Math.round(value * 100) / 100;
}

function offsetCalendarDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validCalendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(value.getTime()) && value.toISOString().slice(0, 10) === date;
}

export async function prepareEstimatedMeal(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  input: EstimatedMealDraftInput,
) {
  if (!["breakfast", "lunch", "dinner", "snack"].includes(input.meal_type)) {
    throw new Error("Choose breakfast, lunch, dinner, or snack.");
  }
  if (!Number.isInteger(input.days_ago) || input.days_ago < 0 || input.days_ago > 3650) {
    throw new Error("Days ago must be a whole number between 0 and 3650.");
  }
  if (input.meal_date && input.days_ago !== 0) {
    throw new Error("Use either an exact meal date or days ago, not both.");
  }

  const { data: preferences, error: preferenceError } = await supabase
    .from("user_training_preferences")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  assertResult(preferenceError, "load timezone");
  const today = dateInTimeZone(
    preferences?.timezone ?? "America/Indiana/Indianapolis",
  );
  const mealDate = input.meal_date ?? offsetCalendarDate(today, -input.days_ago);
  if (!validCalendarDate(mealDate)) throw new Error("Meal date must use a valid YYYY-MM-DD date.");
  if (mealDate > today) throw new Error("Meal logs cannot be dated in the future.");

  const foodName = input.food_name.trim().slice(0, 160);
  const description = input.description.trim().slice(0, 1000);
  const servingSize = input.serving_size.trim().slice(0, 160);
  if (!foodName || !description || !servingSize) {
    throw new Error("Food name, description, and serving size are required.");
  }

  const payload = {
    food_name: foodName,
    description,
    serving_size: servingSize,
    meal_type: input.meal_type,
    meal_date: mealDate,
    calories: estimatedNutritionNumber(input.calories, "Calories", 10000),
    protein_g: estimatedNutritionNumber(input.protein_g, "Protein", 2000),
    carbs_g: estimatedNutritionNumber(input.carbs_g, "Carbohydrates", 2000),
    fat_g: estimatedNutritionNumber(input.fat_g, "Fat", 2000),
    saturated_fat_g: estimatedNutritionNumber(input.saturated_fat_g, "Saturated fat", 1000),
    fiber_g: estimatedNutritionNumber(input.fiber_g, "Fiber", 1000),
    soluble_fiber_g: estimatedNutritionNumber(input.soluble_fiber_g, "Soluble fiber", 1000),
    sugar_g: estimatedNutritionNumber(input.sugar_g, "Sugar", 2000),
    sodium_mg: estimatedNutritionNumber(input.sodium_mg, "Sodium", 100000),
    assumptions: input.assumptions
      .map((assumption) => assumption.trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 8),
  };
  if (payload.calories == null || payload.protein_g == null
    || payload.carbs_g == null || payload.fat_g == null) {
    throw new Error("Calories, protein, carbohydrates, and fat are required.");
  }

  const { data, error } = await supabase
    .from("assistant_meal_drafts")
    .insert({ conversation_id: conversationId, user_id: userId, payload })
    .select("id,payload")
    .single();
  assertResult(error, "prepare meal estimate");
  if (!data) throw new Error("Unable to read the prepared meal estimate.");

  return {
    confirmation_required: true,
    draft: { id: data.id, ...(data.payload as typeof payload) },
  };
}

export async function confirmEstimatedMeal(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
) {
  const { data, error } = await supabase.rpc("confirm_meal_draft", {
    p_user_id: userId,
    p_draft_id: draftId,
  });
  assertResult(error, "confirm meal estimate");
  return { confirmation_required: false, ...(data as Record<string, unknown>) };
}

export async function getCurrentOrNextWorkout(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrengthWorkout> {
  return (await getActiveWorkoutSession(supabase, userId)) ?? getNextWorkoutTemplate(supabase, userId);
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
    notes: plan.notes ?? null,
    status: plan.status,
    started_at: plan.started_at,
    completed_at: plan.completed_at,
    warmups: Array.isArray(plan.warmups)
      ? plan.warmups.filter((item: unknown): item is string => typeof item === "string")
      : [],
    exercises,
    is_template: false,
    template_id: plan.template_id ?? null,
    rotation_position: null,
  };
}

export async function listWorkoutRotation(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("strength_workout_templates")
    .select("id,name,rotation_position,estimated_minutes,notes,active")
    .eq("user_id", userId)
    .order("rotation_position");
  assertResult(error, "list workout rotation");
  return { workouts: data ?? [] };
}

export async function getRotationWorkout(
  supabase: SupabaseClient,
  userId: string,
  input: { template_id: string | null; rotation_position: number | null },
) {
  let query = supabase
    .from("strength_workout_templates")
    .select("id")
    .eq("user_id", userId);
  query = input.template_id
    ? query.eq("id", input.template_id)
    : query.eq("rotation_position", input.rotation_position ?? 1);
  const { data, error } = await query.maybeSingle();
  assertResult(error, "find workout rotation template");
  if (!data) throw new Error("No workout exists at that rotation position.");
  return getWorkoutTemplateById(supabase, userId, data.id);
}

export async function setNextRotationWorkout(
  supabase: SupabaseClient,
  userId: string,
  rotationPosition: number,
) {
  const workout = await getRotationWorkout(supabase, userId, {
    template_id: null,
    rotation_position: rotationPosition,
  });
  const { error } = await supabase
    .from("strength_workout_rotation_state")
    .upsert(
      { user_id: userId, next_template_id: workout.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  assertResult(error, "set next workout in rotation");
  return workout;
}

type SaveRotationWorkoutInput = {
  template_id: string | null;
  rotation_position: number;
  name: string;
  estimated_minutes: number;
  warmups: string[];
  notes: string | null;
  active: boolean;
  exercises: SaveStrengthWorkoutPlanInput["exercises"];
};

export async function saveRotationWorkout(
  supabase: SupabaseClient,
  userId: string,
  input: SaveRotationWorkoutInput,
) {
  const templatePayload = {
    user_id: userId,
    rotation_position: input.rotation_position,
    name: input.name.trim(),
    estimated_minutes: input.estimated_minutes,
    warmups: input.warmups.map((item) => item.trim()).filter(Boolean),
    notes: input.notes?.trim() || null,
    active: input.active,
    updated_at: new Date().toISOString(),
  };
  const result = input.template_id
    ? await supabase
        .from("strength_workout_templates")
        .update(templatePayload)
        .eq("id", input.template_id)
        .eq("user_id", userId)
        .select("id")
        .single()
    : await supabase
        .from("strength_workout_templates")
        .insert(templatePayload)
        .select("id")
        .single();
  assertResult(result.error, "save workout rotation template");
  if (!result.data) throw new Error("save workout rotation template: no template returned");
  const templateId = result.data.id as string;

  const { error: deleteError } = await supabase
    .from("strength_workout_template_exercises")
    .delete()
    .eq("template_id", templateId)
    .eq("user_id", userId);
  assertResult(deleteError, "replace workout rotation exercises");
  if (input.exercises.length) {
    const { error: insertError } = await supabase
      .from("strength_workout_template_exercises")
      .insert(input.exercises.map((exercise, index) => ({
        template_id: templateId,
        user_id: userId,
        exercise_name: exercise.exercise_name.trim(),
        position: index + 1,
        target_sets: exercise.target_sets,
        target_reps: exercise.target_reps,
        target_weight_lbs: exercise.target_weight_lbs,
        training_role: exercise.training_role,
        rest_seconds: exercise.rest_seconds,
        notes: exercise.notes?.trim() || null,
      })));
    assertResult(insertError, "save workout rotation exercises");
  }

  const { data: state } = await supabase
    .from("strength_workout_rotation_state")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!state && input.active) {
    await setNextRotationWorkout(supabase, userId, input.rotation_position);
  }
  return getWorkoutTemplateById(supabase, userId, templateId);
}

export async function listStrengthWorkoutPlans(
  supabase: SupabaseClient,
  userId: string,
  input: { date_from: string | null; date_to: string | null },
) {
  let query = supabase
    .from("strength_workout_plans")
    .select("id,name,scheduled_for,estimated_minutes,status,notes,started_at,completed_at")
    .eq("user_id", userId)
    .order("scheduled_for", { ascending: true })
    .limit(90);
  if (input.date_from) query = query.gte("scheduled_for", input.date_from);
  if (input.date_to) query = query.lte("scheduled_for", input.date_to);

  const { data, error } = await query;
  assertResult(error, "list strength workout plans");
  return { workouts: data ?? [] };
}

export async function getStrengthWorkoutPlan(
  supabase: SupabaseClient,
  userId: string,
  input: { plan_id: string | null; scheduled_for: string | null },
) {
  let query = supabase
    .from("strength_workout_plans")
    .select("id")
    .eq("user_id", userId);
  query = input.plan_id
    ? query.eq("id", input.plan_id)
    : query.eq("scheduled_for", input.scheduled_for ?? appDay()).order("created_at").limit(1);

  const { data, error } = await query.maybeSingle();
  assertResult(error, "find strength workout plan");
  if (!data) {
    throw new Error(
      input.plan_id
        ? "No saved strength workout matches that plan ID."
        : `No saved strength workout exists for ${input.scheduled_for ?? appDay()}.`,
    );
  }
  return getWorkoutById(supabase, userId, data.id);
}

type SaveStrengthWorkoutPlanInput = {
  plan_id: string | null;
  scheduled_for: string;
  name: string;
  estimated_minutes: number;
  warmups: string[];
  notes: string | null;
  exercises: Array<{
    id: string | null;
    exercise_name: string;
    target_sets: number;
    target_reps: number;
    target_weight_lbs: number | null;
    training_role: StrengthTrainingRole;
    rest_seconds: number;
    notes: string | null;
  }>;
  confirm_destructive: boolean;
};

export async function saveStrengthWorkoutPlan(
  supabase: SupabaseClient,
  userId: string,
  input: SaveStrengthWorkoutPlanInput,
) {
  const { data, error } = await supabase.rpc("save_strength_workout_plan", {
    p_user_id: userId,
    p_plan_id: input.plan_id,
    p_scheduled_for: input.scheduled_for,
    p_name: input.name,
    p_estimated_minutes: input.estimated_minutes,
    p_warmups: input.warmups,
    p_notes: input.notes,
    p_exercises: input.exercises,
    p_confirm_destructive: input.confirm_destructive,
  });
  assertResult(error, "save strength workout plan");

  const result = data as {
    updated: boolean;
    created?: boolean;
    confirmation_required: boolean;
    plan_id: string;
    removed_exercise_count: number;
    removed_logged_set_count: number;
  };
  return {
    ...result,
    workout: await getWorkoutById(supabase, userId, result.plan_id),
  };
}

export async function deleteStrengthWorkoutPlan(
  supabase: SupabaseClient,
  userId: string,
  input: { plan_id: string; confirm_destructive: boolean },
) {
  const workout = await getWorkoutById(supabase, userId, input.plan_id);
  const loggedSetCount = workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const needsConfirmation = workout.status !== "scheduled" || loggedSetCount > 0;
  if (needsConfirmation && !input.confirm_destructive) {
    return {
      deleted: false,
      confirmation_required: true,
      reason: "This workout has started, completed, or contains logged sets.",
      plan_id: workout.id,
      workout_name: workout.name,
      status: workout.status,
      logged_set_count: loggedSetCount,
    };
  }

  const { error } = await supabase
    .from("strength_workout_plans")
    .delete()
    .eq("id", workout.id)
    .eq("user_id", userId);
  assertResult(error, "delete strength workout plan");
  return {
    deleted: true,
    confirmation_required: false,
    plan_id: workout.id,
    workout_name: workout.name,
    logged_set_count: loggedSetCount,
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
    .select("id,role,content,created_at,metadata")
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
    .select("id,role,content,created_at,metadata")
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

export async function startNextWorkout(supabase: SupabaseClient, userId: string) {
  const current = await getCurrentOrNextWorkout(supabase, userId);
  if (!current.is_template) {
    if (current.status === "in_progress") return current;
    const { error } = await supabase
      .from("strength_workout_plans")
      .update({ status: "in_progress", started_at: current.started_at ?? new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", current.id)
      .eq("user_id", userId);
    assertResult(error, "resume workout");
    return getWorkoutById(supabase, userId, current.id);
  }

  const { data: plan, error } = await supabase
    .from("strength_workout_plans")
    .insert({
      user_id: userId,
      template_id: current.template_id,
      name: current.name,
      scheduled_for: appDay(),
      estimated_minutes: current.estimated_minutes,
      warmups: current.warmups,
      notes: current.notes,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  assertResult(error, "start next workout");
  if (!plan) throw new Error("start next workout: no session returned");

  if (current.exercises.length) {
    const { error: exerciseError } = await supabase
      .from("strength_plan_exercises")
      .insert(current.exercises.map((exercise) => ({
        plan_id: plan.id,
        user_id: userId,
        exercise_name: exercise.exercise_name,
        position: exercise.position,
        target_sets: exercise.target_sets,
        target_reps: exercise.target_reps,
        target_weight_lbs: exercise.target_weight_lbs,
        training_role: exercise.training_role,
        rest_seconds: exercise.rest_seconds,
        notes: exercise.notes,
      })));
    assertResult(exerciseError, "copy next workout exercises");
  }
  return getWorkoutById(supabase, userId, plan.id);
}

export async function returnTodayWorkoutToScheduled(
  supabase: SupabaseClient,
  userId: string,
) {
  const workout = await getActiveWorkoutSession(supabase, userId);
  if (!workout) throw new Error("There is no active workout to pause.");
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
  const currentWorkout = await getActiveWorkoutSession(supabase, userId);
  if (!currentWorkout) throw new Error("Start the next workout before replacing the active session.");
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
  const workout = await getCurrentOrNextWorkout(supabase, userId);
  const cleaned = warmups.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length > 10) throw new Error("A workout can have at most 10 warm-up items.");
  if (cleaned.some((item) => item.length > 160)) {
    throw new Error("Each warm-up item must be 160 characters or fewer.");
  }

  const { error } = await supabase
    .from(workout.is_template ? "strength_workout_templates" : "strength_workout_plans")
    .update({ warmups: cleaned, updated_at: new Date().toISOString() })
    .eq("id", workout.id)
    .eq("user_id", userId)
    .select("id")
    .single();
  assertResult(error, "update workout warm-ups");
  return workout.is_template
    ? getWorkoutTemplateById(supabase, userId, workout.id)
    : getWorkoutById(supabase, userId, workout.id);
}

async function findExercise(
  supabase: SupabaseClient,
  userId: string,
  exerciseName: string,
) {
  const workout = await getCurrentOrNextWorkout(supabase, userId);
  const direct = workout.exercises.find(
    (exercise) => exercise.exercise_name.toLowerCase() === exerciseName.toLowerCase(),
  );
  const partial = workout.exercises.find((exercise) =>
    exercise.exercise_name.toLowerCase().includes(exerciseName.toLowerCase()),
  );
  const exercise = direct ?? partial;
  if (!exercise) throw new Error(`Exercise not found in the current or next workout: ${exerciseName}`);
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
    .from(workout.is_template ? "strength_workout_template_exercises" : "strength_plan_exercises")
    .update({ target_weight_lbs: input.target_weight_lbs })
    .eq("id", exercise.id)
    .eq("user_id", userId)
    .select("id")
    .single();
  assertResult(error, "update exercise target weight");
  return workout.is_template
    ? getWorkoutTemplateById(supabase, userId, workout.id)
    : getWorkoutById(supabase, userId, workout.id);
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
    .from(workout.is_template ? "strength_workout_template_exercises" : "strength_plan_exercises")
    .update({ training_role: input.training_role })
    .eq("id", exercise.id)
    .eq("user_id", userId)
    .select("id")
    .single();
  assertResult(error, "update exercise training role");
  return workout.is_template
    ? getWorkoutTemplateById(supabase, userId, workout.id)
    : getWorkoutById(supabase, userId, workout.id);
}

export async function logStrengthSet(
  supabase: SupabaseClient,
  userId: string,
  input: { exercise_name: string; weight_lbs: number; reps: number; set_number?: number; rir?: number; notes?: string },
) {
  await startNextWorkout(supabase, userId);
  const { exercise } = await findExercise(supabase, userId, input.exercise_name);
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
  const workout = await getActiveWorkoutSession(supabase, userId);
  if (!workout) throw new Error("There is no active workout to complete. Start the next workout first.");
  const { data, error } = await supabase.rpc("complete_strength_workout", {
    p_user_id: userId,
    p_plan_id: workout.id,
  });
  assertResult(error, "complete workout");
  if (!data || typeof data !== "object") {
    throw new Error("complete workout: invalid database response");
  }

  return {
    ...(data as Record<string, unknown>),
    workout: await getWorkoutById(supabase, userId, workout.id),
  };
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
