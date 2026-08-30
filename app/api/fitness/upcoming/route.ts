import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function dateDifferenceInDays(start: string, end: string) {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
        86_400_000,
    ),
  );
}

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const today = appDay();

    const [raceResult, activeWorkoutResult, queuedWorkoutResult] = await Promise.all([
      supabase
        .from("running_races")
        .select("id,race_name,race_date,distance_miles,location,goal_time_minutes")
        .eq("user_id", userId)
        .eq("status", "scheduled")
        .gte("race_date", today)
        .order("race_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("strength_workout_plans")
        .select("id,name,estimated_minutes,status,scheduled_for")
        .eq("user_id", userId)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("strength_workout_plans")
        .select("id,name,estimated_minutes,status,scheduled_for")
        .eq("user_id", userId)
        .eq("status", "scheduled")
        .order("scheduled_for", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (raceResult.error) throw new Error(`load next race: ${raceResult.error.message}`);
    if (activeWorkoutResult.error) throw new Error(`load active workout: ${activeWorkoutResult.error.message}`);
    if (queuedWorkoutResult.error) throw new Error(`load next workout: ${queuedWorkoutResult.error.message}`);

    const workout = activeWorkoutResult.data ?? queuedWorkoutResult.data;
    let exerciseNames: string[] = [];
    let exerciseCount = 0;

    if (workout) {
      const exerciseResult = await supabase
        .from("strength_plan_exercises")
        .select("exercise_name", { count: "exact" })
        .eq("user_id", userId)
        .eq("plan_id", workout.id)
        .order("position", { ascending: true })
        .limit(3);
      if (exerciseResult.error) {
        throw new Error(`load next workout exercises: ${exerciseResult.error.message}`);
      }
      exerciseNames = (exerciseResult.data ?? []).map((item) => item.exercise_name);
      exerciseCount = exerciseResult.count ?? exerciseNames.length;
    }

    const race = raceResult.data;
    return NextResponse.json({
      race: race
        ? {
            ...race,
            distance_miles: Number(race.distance_miles),
            days_until: dateDifferenceInDays(today, race.race_date),
          }
        : null,
      workout: workout
        ? {
            ...workout,
            exercise_count: exerciseCount,
            exercise_names: exerciseNames,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load upcoming fitness details.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Authentication") || message.includes("session") ? 401 : 400 },
    );
  }
}
