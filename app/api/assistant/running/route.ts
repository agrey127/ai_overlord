import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";
import { getRunningCoachContext } from "@/lib/assistant/running-coach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    return NextResponse.json(await getRunningCoachContext(supabase, userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the Running coach.";
    return NextResponse.json({ error: message }, {
      status: message.includes("Authentication") || message.includes("session") ? 401 : 500,
    });
  }
}
