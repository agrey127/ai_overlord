import OpenAI from "openai";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/authenticated";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticateRequest(request);
    const body = (await request.json()) as { conversationId?: string; messageId?: string };
    if (!body.conversationId || !body.messageId) {
      return NextResponse.json({ error: "Choose an assistant reply to speak." }, { status: 400 });
    }

    const { data: message, error } = await supabase
      .from("assistant_messages")
      .select("content")
      .eq("id", body.messageId)
      .eq("conversation_id", body.conversationId)
      .eq("user_id", userId)
      .eq("role", "assistant")
      .single();
    if (error || !message?.content) {
      return NextResponse.json({ error: "That assistant reply is unavailable." }, { status: 404 });
    }

    const spokenText = message.content.length > 3800
      ? `${message.content.slice(0, 3750)}. The rest of the response is on screen.`
      : message.content;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: spokenText,
      response_format: "mp3",
    });
    return new NextResponse(new Uint8Array(await speech.arrayBuffer()), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Authentication required." || message === "Your session is no longer valid.") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to speak this reply." }, { status: 500 });
  }
}
