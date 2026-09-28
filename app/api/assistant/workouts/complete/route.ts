import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";
import {
  completeTodayWorkout,
  getConversation,
  getCurrentOrNextWorkout,
  saveMessage,
} from "@/lib/assistant/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const body = (await request.json()) as { conversationId?: string | null };
    if (!body.conversationId) {
      return NextResponse.json({ error: "A strength conversation is required." }, { status: 400 });
    }

    const conversation = await getConversation(supabase, userId, body.conversationId);
    if (conversation.domain !== "strength") {
      return NextResponse.json({ error: "Workouts can only be completed from the strength chat." }, { status: 400 });
    }

    await saveMessage(supabase, {
      conversationId: conversation.id,
      userId,
      role: "user",
      content: "Finish my current workout.",
    });

    const result = await completeTodayWorkout(supabase, userId);
    await saveMessage(supabase, {
      conversationId: conversation.id,
      userId,
      role: "tool",
      content: JSON.stringify(result),
      toolName: "complete_workout",
    });

    const completion = result as unknown as {
      completed_set_count?: number;
      workout?: { name?: string };
    };
    const completedSetCount = Number(completion.completed_set_count ?? 0);
    const workout = completion.workout;
    const answer = `${workout?.name ?? "Workout"} completed with ${completedSetCount} working set${completedSetCount === 1 ? "" : "s"} logged. Your strength activity was saved and the rotation advanced.`;
    const message = await saveMessage(supabase, {
      conversationId: conversation.id,
      userId,
      role: "assistant",
      content: answer,
    });

    return NextResponse.json({
      conversationId: conversation.id,
      message,
      workout: await getCurrentOrNextWorkout(supabase, userId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The workout could not be completed.";
    const status = message.includes("Authentication") || message.includes("session") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
