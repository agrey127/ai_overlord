import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";
import { getCurrentOrNextWorkout } from "@/lib/assistant/repository";

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

    const [raceResult, workout] = await Promise.all([
      supabase
        .from("running_races")
        .select("id,race_name,race_date,distance_miles,location,goal_time_minutes")
        .eq("user_id", userId)
        .eq("status", "scheduled")
        .gte("race_date", today)
        .order("race_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      getCurrentOrNextWorkout(supabase, userId),
    ]);

    if (raceResult.error) throw new Error(`load next race: ${raceResult.error.message}`);

    const race = raceResult.data;
    return NextResponse.json({
      race: race
        ? {
            ...race,
            distance_miles: Number(race.distance_miles),
            days_until: dateDifferenceInDays(today, race.race_date),
          }
        : null,
      workout: {
        id: workout.id,
        name: workout.name,
        estimated_minutes: workout.estimated_minutes,
        status: workout.status,
        scheduled_for: workout.scheduled_for,
        rotation_position: workout.rotation_position,
        exercise_count: workout.exercises.length,
        exercise_names: workout.exercises.slice(0, 3).map((exercise) => exercise.exercise_name),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load upcoming fitness details.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Authentication") || message.includes("session") ? 401 : 400 },
    );
  }
}
