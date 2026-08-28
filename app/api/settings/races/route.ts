import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";

export const runtime = "nodejs";

function parseRace(value: unknown) {
  const input = (value ?? {}) as Record<string, unknown>;
  const raceName = String(input.race_name ?? "").trim();
  const raceDate = String(input.race_date ?? "");
  const distance = Number(input.distance_miles);
  const location = String(input.location ?? "").trim();
  const notes = String(input.notes ?? "").trim();
  const goalTime = input.goal_time_minutes === null || input.goal_time_minutes === "" ? null : Number(input.goal_time_minutes);
  const status = String(input.status ?? "scheduled");
  if (!raceName || raceName.length > 120) throw new Error("Enter a race name up to 120 characters.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) throw new Error("Enter a race date.");
  if (!Number.isFinite(distance) || distance <= 0 || distance > 1000) throw new Error("Enter a valid race distance.");
  if (location.length > 160 || notes.length > 2000) throw new Error("Race details are too long.");
  if (goalTime !== null && (!Number.isInteger(goalTime) || goalTime < 1 || goalTime > 100000)) throw new Error("Enter goal time in whole minutes.");
  if (!["scheduled", "completed", "cancelled"].includes(status)) throw new Error("Choose a valid race status.");
  return { race_name: raceName, race_date: raceDate, distance_miles: distance, location: location || null, notes: notes || null, goal_time_minutes: goalTime, status };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to save race.";
  return NextResponse.json({ error: message }, { status: message.includes("Authentication") || message.includes("session") ? 401 : 400 });
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const race = parseRace((await request.json()).race);
    const { data, error } = await supabase.from("running_races").insert({ ...race, user_id: userId }).select("id, race_name, race_date, distance_miles, location, goal_time_minutes, notes, status").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ race: data }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) throw new Error("Race ID is required.");
    const race = parseRace(body.race);
    const { data, error } = await supabase.from("running_races").update({ ...race, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select("id, race_name, race_date, distance_miles, location, goal_time_minutes, notes, status").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ race: data });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Race ID is required.");
    const { error } = await supabase.from("running_races").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ deleted: true });
  } catch (error) { return errorResponse(error); }
}
