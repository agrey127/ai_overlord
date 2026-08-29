import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mealTypes = new Set(["breakfast", "lunch", "dinner", "snack"]);

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

function scaled(value: unknown, servings: number) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * servings * 100) / 100 : null;
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const body = (await request.json()) as {
      savedMealId?: unknown;
      mealType?: unknown;
      servings?: unknown;
    };
    const savedMealId = String(body.savedMealId ?? "").trim();
    const mealType = String(body.mealType ?? "").trim().toLowerCase();
    const servings = Number(body.servings);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedMealId)) {
      return NextResponse.json({ error: "Choose a valid saved meal." }, { status: 400 });
    }
    if (!mealTypes.has(mealType)) {
      return NextResponse.json({ error: "Choose breakfast, lunch, dinner, or snack." }, { status: 400 });
    }
    if (!Number.isFinite(servings) || servings <= 0 || servings > 20) {
      return NextResponse.json({ error: "Servings must be between 0.01 and 20." }, { status: 400 });
    }

    const [mealResult, preferenceResult] = await Promise.all([
      supabase
        .from("saved_meals")
        .select("id,name,description,calories,protein_g,carbs_g,fat_g,saturated_fat_g,fiber_g,soluble_fiber_g,sugar_g,sodium_mg")
        .eq("id", savedMealId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_training_preferences")
        .select("timezone")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (mealResult.error) throw new Error(`Load saved meal: ${mealResult.error.message}`);
    if (preferenceResult.error) throw new Error(`Load timezone: ${preferenceResult.error.message}`);
    if (!mealResult.data) {
      return NextResponse.json({ error: "That saved meal was not found in your account." }, { status: 404 });
    }
    if (mealResult.data.calories == null) {
      return NextResponse.json({ error: "Add calories to this saved meal before logging it." }, { status: 400 });
    }

    const meal = mealResult.data;
    const mealDate = dateInTimeZone(preferenceResult.data?.timezone ?? "America/Indiana/Indianapolis");
    const { data, error } = await supabase
      .from("meal_logs")
      .insert({
        user_id: userId,
        meal_type: mealType,
        meal_date: mealDate,
        logged_at: new Date().toISOString(),
        food_name: meal.name,
        description: meal.description ?? meal.name,
        saved_meal_id: meal.id,
        serving_size: `${servings} serving${servings === 1 ? "" : "s"}`,
        calories: scaled(meal.calories, servings),
        protein_g: scaled(meal.protein_g, servings),
        carbs_g: scaled(meal.carbs_g, servings),
        fat_g: scaled(meal.fat_g, servings),
        saturated_fat_g: scaled(meal.saturated_fat_g, servings),
        fiber_g: scaled(meal.fiber_g, servings),
        soluble_fiber_g: scaled(meal.soluble_fiber_g, servings),
        sugar_g: scaled(meal.sugar_g, servings),
        sodium_mg: scaled(meal.sodium_mg, servings),
      })
      .select("id,meal_type,meal_date,calories,protein_g,carbs_g,fat_g")
      .single();
    if (error) throw new Error(`Log saved meal: ${error.message}`);

    return NextResponse.json({
      logged: {
        ...data,
        meal_name: meal.name,
        servings,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log the saved meal.";
    const status = message.includes("Authentication") || message.includes("session") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
