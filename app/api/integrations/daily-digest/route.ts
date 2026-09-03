import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentOrNextWorkout } from "@/lib/assistant/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenMatches(received: string, expected: string) {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length
    && timingSafeEqual(receivedBytes, expectedBytes);
}

export async function GET(request: Request) {
  const expectedToken = process.env.DAILY_DIGEST_TOKEN;
  const userId = process.env.DAILY_DIGEST_USER_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase secret keys are server-only and supersede the legacy service_role key.
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!expectedToken || !userId || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Daily digest integration is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const receivedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!tokenMatches(receivedToken, expectedToken)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const workout = await getCurrentOrNextWorkout(supabase, userId);

    return NextResponse.json({
      workout: {
        name: workout.name,
        estimated_minutes: workout.estimated_minutes,
        status: workout.status,
        scheduled_for: workout.scheduled_for,
        rotation_position: workout.rotation_position,
        warmups: workout.warmups,
        exercises: workout.exercises.map((exercise) => ({
          name: exercise.exercise_name,
          target_sets: exercise.target_sets,
          target_reps: exercise.target_reps,
          target_weight_lbs: exercise.target_weight_lbs,
        })),
      },
    });
  } catch (error) {
    console.error("daily digest workout lookup failed", error);
    return NextResponse.json({ error: "Unable to load the next workout." }, { status: 500 });
  }
}
