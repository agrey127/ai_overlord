import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";
import {
  createConversation,
  ensureTodayWorkout,
  getMessages,
  listConversations,
} from "@/lib/assistant/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { supabase, user, userId } = await authenticateRequest(request);
    const url = new URL(request.url);
    const requestedConversationId = url.searchParams.get("conversationId");

    const [workout, initialConversations] = await Promise.all([
      ensureTodayWorkout(supabase, userId),
      listConversations(supabase, userId),
    ]);

    let conversations = initialConversations;
    if (!conversations.length) {
      await createConversation(supabase, userId, "Today’s training", "strength");
      conversations = await listConversations(supabase, userId);
    }

    const selectedConversationId =
      conversations.find((conversation) => conversation.id === requestedConversationId)?.id ??
      conversations[0]?.id ??
      null;
    const messages = selectedConversationId
      ? await getMessages(supabase, userId, selectedConversationId)
      : [];

    return NextResponse.json({
      user: { id: user.id, email: user.email ?? null },
      conversations,
      messages,
      selectedConversationId,
      workout,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the assistant.";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication") || message.includes("session") ? 401 : 500 });
  }
}
