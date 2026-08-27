import { NextResponse } from "next/server";
import {
  createConversation,
  getLatestConversationByDomain,
  getMessages,
  saveMessage,
} from "@/lib/assistant/repository";
import type { AssistantThreadDomain } from "@/lib/assistant/types";
import { authenticateRequest } from "@/lib/supabase/authenticated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const threadCopy: Record<AssistantThreadDomain, { title: string; welcome: string }> = {
  strength: {
    title: "New strength chat",
    welcome: "New strength thread. What are we working on?",
  },
  running: {
    title: "New running chat",
    welcome: "New running thread. What run are we planning or reviewing?",
  },
  nutrition: {
    title: "New nutrition chat",
    welcome: "New nutrition thread. What would you like to track or plan?",
  },
};

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const body = (await request.json()) as { domain?: string };
    const domain = body.domain as AssistantThreadDomain;
    const copy = threadCopy[domain];

    if (!copy) {
      return NextResponse.json({ error: "Choose strength, running, or nutrition." }, { status: 400 });
    }

    const existingConversation = await getLatestConversationByDomain(supabase, userId, domain);
    if (existingConversation) {
      const messages = await getMessages(supabase, userId, existingConversation.id);
      return NextResponse.json({ conversation: existingConversation, messages, created: false });
    }

    const conversation = await createConversation(supabase, userId, copy.title, domain);
    const message = await saveMessage(supabase, {
      conversationId: conversation.id,
      userId,
      role: "assistant",
      content: copy.welcome,
    });

    return NextResponse.json({ conversation, messages: [message], created: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the conversation.";
    const status = message.includes("Authentication") || message.includes("session") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
